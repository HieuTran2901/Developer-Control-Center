use super::model::ReadinessStrategy;

pub struct ReadinessResolver;

impl ReadinessResolver {
    pub fn resolve(
        command: &str,
        legacy_regex: Option<String>,
        config: Option<ReadinessStrategy>,
    ) -> ReadinessStrategy {
        if let Some(cfg) = config {
            return cfg;
        }

        if let Some(regex_str) = legacy_regex {
            return ReadinessStrategy::LogPattern { pattern: regex_str };
        }

        let lower_cmd = command.to_lowercase();
        if lower_cmd.contains("spring-boot:run") || lower_cmd.contains("mvnw") {
            // Default Spring Boot log pattern
            ReadinessStrategy::LogPattern {
                pattern: "Started .* in .* seconds".to_string(),
            }
        } else if lower_cmd.contains("npm") || lower_cmd.contains("vite") {
            // Default Vite log pattern
            ReadinessStrategy::LogPattern {
                pattern: "Local:".to_string(),
            }
        } else {
            // Fallback for unknown commands
            ReadinessStrategy::None
        }
    }
}
