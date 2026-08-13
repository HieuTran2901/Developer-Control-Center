use crate::pipeline::domain::PipelineStep;

pub trait EcosystemAnalyzer {
    /// Returns true if the given step command inherently implies a test execution
    fn implies_test(&self, step: &PipelineStep) -> bool;
    
    /// Returns true if the given step command implies compilation/packaging
    fn implies_build(&self, step: &PipelineStep) -> bool;
}

pub struct MavenAnalyzer;

impl EcosystemAnalyzer for MavenAnalyzer {
    fn implies_test(&self, step: &PipelineStep) -> bool {
        if let crate::pipeline::domain::StepConfig::Command { command, args, .. } = &step.config {
            if command.contains("mvn") || command.contains("mvnw") {
                let full_cmd = format!("{} {}", command, args.join(" "));
                if full_cmd.contains("-DskipTests") || full_cmd.contains("-Dmaven.test.skip=true") {
                    return false;
                }
                return full_cmd.contains("test") || full_cmd.contains("package") || full_cmd.contains("install") || full_cmd.contains("verify");
            }
        }
        false
    }

    fn implies_build(&self, step: &PipelineStep) -> bool {
        if let crate::pipeline::domain::StepConfig::Command { command, args, .. } = &step.config {
            if command.contains("mvn") || command.contains("mvnw") {
                let full_cmd = format!("{} {}", command, args.join(" "));
                return full_cmd.contains("compile") || full_cmd.contains("package") || full_cmd.contains("install") || full_cmd.contains("verify");
            }
        }
        false
    }
}

pub struct NpmAnalyzer;

impl EcosystemAnalyzer for NpmAnalyzer {
    fn implies_test(&self, step: &PipelineStep) -> bool {
        if let crate::pipeline::domain::StepConfig::Command { command, args, .. } = &step.config {
            if command.contains("npm") || command.contains("yarn") || command.contains("pnpm") {
                let full_cmd = format!("{} {}", command, args.join(" "));
                return full_cmd.contains("test");
            }
        }
        false
    }

    fn implies_build(&self, step: &PipelineStep) -> bool {
        if let crate::pipeline::domain::StepConfig::Command { command, args, .. } = &step.config {
            if command.contains("npm") || command.contains("yarn") || command.contains("pnpm") {
                let full_cmd = format!("{} {}", command, args.join(" "));
                return full_cmd.contains("build");
            }
        }
        false
    }
}

pub struct CargoAnalyzer;

impl EcosystemAnalyzer for CargoAnalyzer {
    fn implies_test(&self, step: &PipelineStep) -> bool {
        if let crate::pipeline::domain::StepConfig::Command { command, args, .. } = &step.config {
            if command.contains("cargo") {
                return args.contains(&"test".to_string());
            }
        }
        false
    }

    fn implies_build(&self, step: &PipelineStep) -> bool {
        if let crate::pipeline::domain::StepConfig::Command { command, args, .. } = &step.config {
            if command.contains("cargo") {
                return args.contains(&"build".to_string());
            }
        }
        false
    }
}

pub fn get_analyzer(build_tool: &str) -> Option<Box<dyn EcosystemAnalyzer>> {
    let lower = build_tool.to_lowercase();
    if lower.contains("maven") {
        Some(Box::new(MavenAnalyzer))
    } else if lower.contains("npm") || lower.contains("yarn") || lower.contains("pnpm") {
        Some(Box::new(NpmAnalyzer))
    } else if lower.contains("cargo") || lower.contains("rust") {
        Some(Box::new(CargoAnalyzer))
    } else {
        None
    }
}
