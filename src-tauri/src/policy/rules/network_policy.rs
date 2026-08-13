use std::net::{IpAddr, Ipv4Addr, ToSocketAddrs};
use reqwest::Url;
use crate::policy::approval::ApprovalStore;
use crate::policy::models::{PolicyDecision, PolicyEvaluationRequest, RiskLevel};

pub struct NetworkPolicyRule;

impl NetworkPolicyRule {
    pub fn is_private_or_loopback_ip(ip: IpAddr) -> bool {
        match ip {
            IpAddr::V4(ipv4) => {
                let octets = ipv4.octets();
                ipv4.is_loopback()
                    || ipv4.is_private()
                    || ipv4.is_link_local()
                    || octets[0] == 127
                    || octets[0] == 10
                    || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
                    || (octets[0] == 192 && octets[1] == 168)
                    || (octets[0] == 169 && octets[1] == 254) // AWS Metadata & Link-Local
            }
            IpAddr::V6(ipv6) => {
                if ipv6.is_loopback() {
                    return true;
                }
                let segments = ipv6.segments();
                if (segments[0] & 0xfe00) == 0xfc00 || (segments[0] & 0xffc0) == 0xfe80 {
                    return true;
                }
                // Check IPv4-mapped IPv6 (::ffff:127.0.0.1)
                if let Some(ipv4) = ipv6.to_ipv4_mapped() {
                    return Self::is_private_or_loopback_ip(IpAddr::V4(ipv4));
                }
                false
            }
        }
    }

    pub fn parse_host_or_ip(host_str: &str) -> Option<IpAddr> {
        let clean_host = host_str.trim().trim_matches('[').trim_matches(']');
        
        // Direct standard IP parse
        if let Ok(ip) = clean_host.parse::<IpAddr>() {
            return Some(ip);
        }

        // Hex IP parse (e.g. 0x7f000001)
        if clean_host.starts_with("0x") || clean_host.starts_with("0X") {
            if let Ok(num) = u32::from_str_radix(&clean_host[2..], 16) {
                return Some(IpAddr::V4(Ipv4Addr::from(num)));
            }
        }

        // Decimal IP parse (e.g. 2130706433)
        if let Ok(num) = clean_host.parse::<u32>() {
            return Some(IpAddr::V4(Ipv4Addr::from(num)));
        }

        // Octal IP parse (e.g. 0177.0.0.1)
        let parts: Vec<&str> = clean_host.split('.').collect();
        if parts.len() == 4 {
            let mut octets = [0u8; 4];
            let mut valid = true;
            for (i, part) in parts.iter().enumerate() {
                if part.starts_with('0') && part.len() > 1 {
                    if let Ok(val) = u8::from_str_radix(&part[1..], 8) {
                        octets[i] = val;
                    } else {
                        valid = false;
                        break;
                    }
                } else if let Ok(val) = part.parse::<u8>() {
                    octets[i] = val;
                } else {
                    valid = false;
                    break;
                }
            }
            if valid {
                return Some(IpAddr::V4(Ipv4Addr::from(octets)));
            }
        }

        None
    }

    pub fn evaluate(request: &PolicyEvaluationRequest) -> Option<PolicyDecision> {
        let url_str = match &request.url {
            Some(u) if !u.trim().is_empty() => u.trim(),
            _ => return None,
        };

        // 1. Strict URL Parsing using reqwest::Url (Strips userinfo: user:pass@host)
        let parsed_url = match Url::parse(url_str) {
            Ok(u) => u,
            Err(_) => {
                return Some(PolicyDecision::Deny {
                    risk_level: RiskLevel::Critical,
                    reason_code: "POLICY_DENY_MALFORMED_URL".to_string(),
                    message: format!("Malformed or unparseable URL '{}'", url_str),
                });
            }
        };

        let host_str = match parsed_url.host_str() {
            Some(h) => h.to_lowercase(),
            None => {
                return Some(PolicyDecision::Deny {
                    risk_level: RiskLevel::Critical,
                    reason_code: "POLICY_DENY_MISSING_URL_HOST".to_string(),
                    message: "URL destination host is missing".to_string(),
                });
            }
        };

        // 2. Direct IP Address & Alternate IP Representation Checks
        if host_str == "localhost" {
            return Some(PolicyDecision::Deny {
                risk_level: RiskLevel::Critical,
                reason_code: "POLICY_DENY_SSRF_ATTEMPT".to_string(),
                message: format!("Access to localhost target '{}' is blocked", url_str),
            });
        }

        if let Some(ip) = Self::parse_host_or_ip(&host_str) {
            if Self::is_private_or_loopback_ip(ip) {
                return Some(PolicyDecision::Deny {
                    risk_level: RiskLevel::Critical,
                    reason_code: "POLICY_DENY_SSRF_ATTEMPT".to_string(),
                    message: format!("Access to private/loopback/metadata IP target '{}' is blocked", url_str),
                });
            }
        }

        // 3. DNS Resolution Checks (Verify hostname does not resolve to private IP)
        let port = parsed_url.port().unwrap_or_else(|| match parsed_url.scheme() {
            "https" => 443,
            _ => 80,
        });

        let socket_addr_str = format!("{}:{}", host_str, port);
        if let Ok(addrs) = socket_addr_str.to_socket_addrs() {
            for addr in addrs {
                if Self::is_private_or_loopback_ip(addr.ip()) {
                    return Some(PolicyDecision::Deny {
                        risk_level: RiskLevel::Critical,
                        reason_code: "POLICY_DENY_SSRF_DNS_RESOLVED_PRIVATE_IP".to_string(),
                        message: format!("Target hostname '{}' resolved to private IP '{}'", host_str, addr.ip()),
                    });
                }
            }
        }

        // 4. Trusted LLM Provider Endpoints Whitelist
        if host_str == "api.openai.com"
            || host_str == "api.anthropic.com"
            || host_str == "generativelanguage.googleapis.com"
        {
            return Some(PolicyDecision::Allow {
                risk_level: RiskLevel::Low,
                reason_code: "POLICY_ALLOW_TRUSTED_PROVIDER_ENDPOINT".to_string(),
            });
        }

        // 5. External Arbitrary HTTP Endpoints Require Approval
        let approval_id = ApprovalStore::generate_unpredictable_approval_id();
        let fingerprint = ApprovalStore::compute_canonical_fingerprint(
            "Network",
            None,
            &[],
            &request.workspace_root,
            &request.policy_version,
            request.pipeline_version,
        );
        Some(PolicyDecision::RequireApproval {
            approval_id,
            risk_level: RiskLevel::High,
            reason_code: "POLICY_REQUIRE_APPROVAL_THIRD_PARTY_NETWORK".to_string(),
            prompt: format!("Outbound request to '{}' requires approval", url_str),
            action_fingerprint: fingerprint,
            expires_at_ms: 300_000,
        })
    }
}
