//! Centralized security finding evidence extraction, bounding, and truncation policy.

/// Authoritative default maximum length (in characters) for any security finding evidence.
pub const DEFAULT_MAX_EVIDENCE_LENGTH: usize = 300;

/// Truncation indicator marker.
pub const TRUNCATION_MARKER: &str = "...";

/// Ensures an arbitrary evidence string does not exceed `max_len` characters.
/// If it exceeds `max_len`, it safely truncates at a UTF-8 character boundary and appends `...`.
pub fn bound_evidence_string(evidence: &str, max_len: usize) -> String {
    let char_count = evidence.chars().count();
    if char_count <= max_len {
        return evidence.to_string();
    }

    if max_len <= TRUNCATION_MARKER.len() {
        return TRUNCATION_MARKER.chars().take(max_len).collect();
    }

    let take_count = max_len - TRUNCATION_MARKER.len();
    let truncated: String = evidence.chars().take(take_count).collect();
    format!("{}{}", truncated.trim_end(), TRUNCATION_MARKER)
}

/// Extracts a match-centered bounded window of evidence from `source` line/content.
///
/// - If `source.chars().count() <= max_len`, returns `source.trim()`.
/// - If `source` is longer than `max_len`, centers the extraction window around `match_range`
///   (or takes the start if `match_range` is None), adding `...` markers when truncated.
/// - The returned string is guaranteed to be at most `max_len` characters.
pub fn extract_bounded_evidence(
    source: &str,
    match_range: Option<(usize, usize)>,
    max_len: usize,
) -> String {
    let trimmed = source.trim();
    let char_count = trimmed.chars().count();
    if char_count <= max_len {
        return trimmed.to_string();
    }

    if max_len <= TRUNCATION_MARKER.len() * 2 {
        return bound_evidence_string(trimmed, max_len);
    }

    let (match_start_byte, match_end_byte) = match match_range {
        Some((start, end)) => (
            start.min(source.len()),
            end.max(start).min(source.len()),
        ),
        None => (0, 0),
    };

    // Convert byte offsets to character index positions within `source`
    let chars: Vec<(usize, char)> = source.char_indices().collect();
    if chars.is_empty() {
        return String::new();
    }

    let match_start_char = chars
        .iter()
        .position(|&(byte_idx, _)| byte_idx >= match_start_byte)
        .unwrap_or(chars.len());
    let match_end_char = chars
        .iter()
        .position(|&(byte_idx, _)| byte_idx >= match_end_byte)
        .unwrap_or(chars.len());

    let match_char_len = match_end_char.saturating_sub(match_start_char);

    // If the match itself is very long (takes up most or all of max_len)
    let marker_len = TRUNCATION_MARKER.len();
    let max_content_budget = max_len.saturating_sub(marker_len * 2);

    let (window_start_char, window_end_char) = if match_char_len >= max_content_budget {
        // Center on match start
        let start = match_start_char;
        let end = (start + max_content_budget).min(chars.len());
        (start, end)
    } else {
        let remaining_budget = max_content_budget.saturating_sub(match_char_len);
        let desired_before = remaining_budget / 2;
        let desired_after = remaining_budget - desired_before;

        let available_before = match_start_char;
        let available_after = chars.len().saturating_sub(match_end_char);

        let (actual_before, actual_after) = if available_before < desired_before {
            let surplus = desired_before - available_before;
            (available_before, (desired_after + surplus).min(available_after))
        } else if available_after < desired_after {
            let surplus = desired_after - available_after;
            ((desired_before + surplus).min(available_before), available_after)
        } else {
            (desired_before, desired_after)
        };

        let start = match_start_char.saturating_sub(actual_before);
        let end = (match_end_char + actual_after).min(chars.len());
        (start, end)
    };

    let has_prefix_trunc = window_start_char > 0;
    let has_suffix_trunc = window_end_char < chars.len();

    let mut result = String::with_capacity(max_len);
    if has_prefix_trunc {
        result.push_str(TRUNCATION_MARKER);
    }

    let snippet: String = chars[window_start_char..window_end_char]
        .iter()
        .map(|&(_, c)| c)
        .collect();
    result.push_str(&snippet);

    if has_suffix_trunc {
        result.push_str(TRUNCATION_MARKER);
    }

    // Final safety check: if total chars exceed max_len, clamp safely
    bound_evidence_string(&result, max_len)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_short_evidence_not_truncated() {
        let source = "const apiKey = 'secret_12345';";
        let bounded = extract_bounded_evidence(source, Some((16, 28)), DEFAULT_MAX_EVIDENCE_LENGTH);
        assert_eq!(bounded, source);
        assert_eq!(bounded.chars().count(), source.chars().count());
    }

    #[test]
    fn test_exact_limit_evidence() {
        let source = "a".repeat(DEFAULT_MAX_EVIDENCE_LENGTH);
        let bounded = extract_bounded_evidence(&source, None, DEFAULT_MAX_EVIDENCE_LENGTH);
        assert_eq!(bounded.chars().count(), DEFAULT_MAX_EVIDENCE_LENGTH);
        assert_eq!(bounded, source);
    }

    #[test]
    fn test_slightly_over_limit_evidence() {
        let source = "a".repeat(DEFAULT_MAX_EVIDENCE_LENGTH + 10);
        let bounded = extract_bounded_evidence(&source, None, DEFAULT_MAX_EVIDENCE_LENGTH);
        assert!(bounded.chars().count() <= DEFAULT_MAX_EVIDENCE_LENGTH);
        assert!(bounded.ends_with(TRUNCATION_MARKER));
    }

    #[test]
    fn test_huge_line_500k_chars() {
        let prefix = "const a = 1; ".repeat(20000); // ~280,000 chars
        let secret = "API_KEY=super_secret_token_123456";
        let suffix = " const b = 2; ".repeat(20000); // ~280,000 chars
        let source = format!("{}{}{}", prefix, secret, suffix);
        let match_start = prefix.len();
        let match_end = match_start + secret.len();

        let bounded = extract_bounded_evidence(&source, Some((match_start, match_end)), DEFAULT_MAX_EVIDENCE_LENGTH);
        assert!(bounded.chars().count() <= DEFAULT_MAX_EVIDENCE_LENGTH);
        assert!(bounded.contains("API_KEY="));
        assert!(bounded.contains("super_secret_token_123456"));
        assert!(bounded.starts_with(TRUNCATION_MARKER));
        assert!(bounded.ends_with(TRUNCATION_MARKER));
    }

    #[test]
    fn test_match_near_beginning() {
        let secret = "SECRET=xyz123456789";
        let suffix = "x".repeat(1000);
        let source = format!("{}{}", secret, suffix);

        let bounded = extract_bounded_evidence(&source, Some((0, secret.len())), DEFAULT_MAX_EVIDENCE_LENGTH);
        assert!(bounded.chars().count() <= DEFAULT_MAX_EVIDENCE_LENGTH);
        assert!(bounded.starts_with("SECRET="));
        assert!(bounded.ends_with(TRUNCATION_MARKER));
    }

    #[test]
    fn test_match_near_middle() {
        let prefix = "x".repeat(500);
        let secret = "SECRET=middle_key_12345";
        let suffix = "y".repeat(500);
        let source = format!("{}{}{}", prefix, secret, suffix);
        let match_start = prefix.len();
        let match_end = match_start + secret.len();

        let bounded = extract_bounded_evidence(&source, Some((match_start, match_end)), DEFAULT_MAX_EVIDENCE_LENGTH);
        assert!(bounded.chars().count() <= DEFAULT_MAX_EVIDENCE_LENGTH);
        assert!(bounded.contains("SECRET=middle_key_12345"));
        assert!(bounded.starts_with(TRUNCATION_MARKER));
        assert!(bounded.ends_with(TRUNCATION_MARKER));
    }

    #[test]
    fn test_match_near_end() {
        let prefix = "x".repeat(1000);
        let secret = "SECRET=end_key_12345";
        let source = format!("{}{}", prefix, secret);
        let match_start = prefix.len();
        let match_end = match_start + secret.len();

        let bounded = extract_bounded_evidence(&source, Some((match_start, match_end)), DEFAULT_MAX_EVIDENCE_LENGTH);
        assert!(bounded.chars().count() <= DEFAULT_MAX_EVIDENCE_LENGTH);
        assert!(bounded.contains("SECRET=end_key_12345"));
        assert!(bounded.starts_with(TRUNCATION_MARKER));
    }

    #[test]
    fn test_bound_evidence_string_preserves_short() {
        let text = "short evidence string";
        let result = bound_evidence_string(text, DEFAULT_MAX_EVIDENCE_LENGTH);
        assert_eq!(result, text);
    }

    #[test]
    fn test_bound_evidence_string_truncates_long() {
        let text = "x".repeat(500);
        let result = bound_evidence_string(&text, 100);
        assert_eq!(result.chars().count(), 100);
        assert!(result.ends_with(TRUNCATION_MARKER));
    }

    #[test]
    fn test_redacted_secret_preservation() {
        use crate::security::redactor::{DefaultRedactor, SecurityRedactor};
        let redactor = DefaultRedactor::new();
        let raw = "API_KEY=sk_live_12345678901234567890_private";
        let redacted = redactor.redact(raw);
        let bounded = bound_evidence_string(&redacted.0, DEFAULT_MAX_EVIDENCE_LENGTH);
        assert!(bounded.contains("API_KEY="));
        assert!(bounded.contains("********"));
        assert!(!bounded.contains("12345678901234567890"));
    }

    #[test]
    fn test_multiple_matches_each_bounded() {
        let line = "key1=secret1234567890; key2=secret0987654321; key3=secret1122334455; ".repeat(100);
        let match1_range = (5, 21);
        let match2_range = (45, 61);

        let bounded1 = extract_bounded_evidence(&line, Some(match1_range), DEFAULT_MAX_EVIDENCE_LENGTH);
        let bounded2 = extract_bounded_evidence(&line, Some(match2_range), DEFAULT_MAX_EVIDENCE_LENGTH);

        assert!(bounded1.chars().count() <= DEFAULT_MAX_EVIDENCE_LENGTH);
        assert!(bounded2.chars().count() <= DEFAULT_MAX_EVIDENCE_LENGTH);
        assert!(bounded1.contains("key1="));
        assert!(bounded2.contains("key2="));
    }

    #[test]
    fn test_normal_multiline_source_evidence() {
        let snippet = "function connect() {\n    const token = process.env.AUTH_TOKEN;\n    return token;\n}";
        let bounded = bound_evidence_string(snippet, DEFAULT_MAX_EVIDENCE_LENGTH);
        assert_eq!(bounded, snippet);
    }
}

