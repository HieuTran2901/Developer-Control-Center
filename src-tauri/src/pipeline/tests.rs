#[cfg(test)]
mod domain_tests {
    use std::collections::HashMap;
    use crate::pipeline::domain::*;
    use serde_json::Value;

    fn create_valid_pipeline() -> PipelineDefinition {
        PipelineDefinition {
            id: "pipe-1".into(),
            name: "Test Pipeline".into(),
            description: None,
            version: 1,
            trigger: "manual".into(),
            stages: vec![PipelineStage {
                id: "stage-1".into(),
                name: "Build Stage".into(),
                order: 1,
                steps: vec![PipelineStep {
                    id: "step-1".into(),
                    name: "Echo Step".into(),
                    step_type: PipelineStepType::Command,
                    config: StepConfig::Command {
                        command: "echo".into(),
                        args: vec!["hello".into()],
                        cwd: None,
                    },
                    order: 1,
                    timeout_seconds: None,
                }],
            }],
            metadata: HashMap::new(),
        }
    }

    #[test]
    fn test_valid_pipeline() {
        let pipeline = create_valid_pipeline();
        assert!(validate_pipeline(&pipeline).is_ok());
    }

    #[test]
    fn test_empty_pipeline_id() {
        let mut pipeline = create_valid_pipeline();
        pipeline.id = "".into();
        assert!(matches!(validate_pipeline(&pipeline), Err(PipelineError::ValidationError(_))));
    }

    #[test]
    fn test_empty_name() {
        let mut pipeline = create_valid_pipeline();
        pipeline.name = "   ".into();
        assert!(matches!(validate_pipeline(&pipeline), Err(PipelineError::ValidationError(_))));
    }

    #[test]
    fn test_duplicate_stage_id() {
        let mut pipeline = create_valid_pipeline();
        let stage = pipeline.stages[0].clone();
        pipeline.stages.push(stage);
        assert!(matches!(validate_pipeline(&pipeline), Err(PipelineError::ValidationError(msg)) if msg.contains("Duplicate stage ID")));
    }

    #[test]
    fn test_duplicate_step_id() {
        let mut pipeline = create_valid_pipeline();
        let step = pipeline.stages[0].steps[0].clone();
        pipeline.stages[0].steps.push(step);
        assert!(matches!(validate_pipeline(&pipeline), Err(PipelineError::ValidationError(msg)) if msg.contains("Duplicate step ID")));
    }

    #[test]
    fn test_valid_stage() {
        let mut pipeline = create_valid_pipeline();
        pipeline.stages.push(PipelineStage {
            id: "stage-2".into(),
            name: "Test Stage".into(),
            order: 2,
            steps: vec![PipelineStep {
                id: "step-2".into(),
                name: "Test Step".into(),
                step_type: PipelineStepType::Script,
                config: StepConfig::Script {
                    script_content: "exit 0".into(),
                    interpreter: None,
                },
                order: 1,
                timeout_seconds: None,
            }],
        });
        assert!(validate_pipeline(&pipeline).is_ok());
    }

    #[test]
    fn test_empty_stage_name() {
        let mut pipeline = create_valid_pipeline();
        pipeline.stages[0].name = "".into();
        assert!(matches!(validate_pipeline(&pipeline), Err(PipelineError::ValidationError(_))));
    }

    #[test]
    fn test_stage_with_no_steps() {
        let mut pipeline = create_valid_pipeline();
        pipeline.stages[0].steps.clear();
        assert!(matches!(validate_pipeline(&pipeline), Err(PipelineError::ValidationError(_))));
    }

    #[test]
    fn test_valid_step() {
        let pipeline = create_valid_pipeline();
        assert!(!pipeline.stages[0].steps.is_empty());
    }

    #[test]
    fn test_empty_step_id() {
        let mut pipeline = create_valid_pipeline();
        pipeline.stages[0].steps[0].id = "".into();
        assert!(matches!(validate_pipeline(&pipeline), Err(PipelineError::ValidationError(_))));
    }

    #[test]
    fn test_status_valid_transition() {
        assert!(PipelineStatus::Idle.can_transition_to(PipelineStatus::Queued));
        assert!(PipelineStatus::Queued.can_transition_to(PipelineStatus::Running));
        assert!(PipelineStatus::Running.can_transition_to(PipelineStatus::Success));
    }

    #[test]
    fn test_status_invalid_success_to_running() {
        assert!(!PipelineStatus::Success.can_transition_to(PipelineStatus::Running));
    }

    #[test]
    fn test_status_invalid_cancelled_to_running() {
        assert!(!PipelineStatus::Cancelled.can_transition_to(PipelineStatus::Running));
    }

    #[test]
    fn test_serialize_deserialize_round_trip() {
        let pipeline = create_valid_pipeline();
        let serialized = serde_json::to_string(&pipeline).unwrap();
        let deserialized: PipelineDefinition = serde_json::from_str(&serialized).unwrap();
        assert_eq!(pipeline, deserialized);
    }

    #[test]
    fn test_pipeline_json_security_no_secrets() {
        let pipeline = create_valid_pipeline();
        let serialized = serde_json::to_string(&pipeline).unwrap();
        let json_value: Value = serde_json::from_str(&serialized).unwrap();
        
        let json_str = json_value.to_string().to_lowercase();
        // Assert json doesn't have accidental leak paths
        assert!(!json_str.contains("apikey"));
        assert!(!json_str.contains("secret"));
        assert!(!json_str.contains("authorization"));
    }

    #[test]
    fn test_ai_agent_provider_id_preserved() {
        let mut pipeline = create_valid_pipeline();
        pipeline.stages[0].steps[0].step_type = PipelineStepType::AiAgent;
        pipeline.stages[0].steps[0].config = StepConfig::AiAgent {
            provider_id: "openai-prod".into(),
            model: Some("gpt-4".into()),
            system_prompt: None,
            user_prompt_template: "Hello".into(),
        };

        let serialized = serde_json::to_string(&pipeline).unwrap();
        let deserialized: PipelineDefinition = serde_json::from_str(&serialized).unwrap();

        if let StepConfig::AiAgent { provider_id, .. } = &deserialized.stages[0].steps[0].config {
            assert_eq!(provider_id, "openai-prod");
        } else {
            panic!("Wrong step config");
        }
    }
}

#[cfg(test)]
mod executor_tests {
    use std::sync::Arc;
    use std::sync::atomic::{AtomicBool, Ordering};
    use crate::pipeline::domain::*;
    use crate::pipeline::executor::{StepExecutor, MockStepExecutor, AiStepExecutor, StepResult};
    use crate::ai::AIGateway;
    use crate::ai::credential_store::CredentialStoreTrait;
    use crate::ai::gateway::mock_adapter::{MockAIProviderAdapter, MockBehavior};
    
    #[tokio::test]
    async fn test_mock_step_success() {
        let step = PipelineStep {
            id: "step-mock".into(),
            name: "Mock Success".into(),
            step_type: PipelineStepType::Mock,
            config: StepConfig::Mock {
                behavior: "success".into(),
                output: Some("mock output content".into()),
            },
            order: 1,
            timeout_seconds: None,
        };
        let executor = MockStepExecutor;
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let res = executor.execute(&step, None, cancel_flag).await.unwrap();
        
        assert_eq!(res.status, PipelineStatus::Success);
        assert_eq!(res.output, Some("mock output content".into()));
        assert!(res.error.is_none());
    }

    #[tokio::test]
    async fn test_mock_step_failure() {
        let step = PipelineStep {
            id: "step-mock".into(),
            name: "Mock Failure".into(),
            step_type: PipelineStepType::Mock,
            config: StepConfig::Mock {
                behavior: "failure".into(),
                output: Some("Simulated error content".into()),
            },
            order: 1,
            timeout_seconds: None,
        };
        let executor = MockStepExecutor;
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let res = executor.execute(&step, None, cancel_flag).await.unwrap();
        
        assert_eq!(res.status, PipelineStatus::Failed);
        assert_eq!(res.error, Some("Simulated error content".into()));
    }

    #[tokio::test]
    async fn test_mock_step_cancellation() {
        let step = PipelineStep {
            id: "step-mock".into(),
            name: "Mock Cancellation".into(),
            step_type: PipelineStepType::Mock,
            config: StepConfig::Mock {
                behavior: "cancellation".into(),
                output: None,
            },
            order: 1,
            timeout_seconds: None,
        };
        let executor = MockStepExecutor;
        let cancel_flag = Arc::new(AtomicBool::new(false));
        
        let cancel_flag_clone = cancel_flag.clone();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            cancel_flag_clone.store(true, Ordering::Relaxed);
        });

        let res = executor.execute(&step, None, cancel_flag).await.unwrap();
        
        assert_eq!(res.status, PipelineStatus::Cancelled);
        assert!(res.error.unwrap().contains("cancelled"));
    }

    #[tokio::test]
    async fn test_invalid_step_config_rejected() {
        let step = PipelineStep {
            id: "step-ai".into(),
            name: "AI step".into(),
            step_type: PipelineStepType::AiAgent,
            config: StepConfig::Mock {
                behavior: "success".into(),
                output: None,
            },
            order: 1,
            timeout_seconds: None,
        };
        let executor = AiStepExecutor;
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let res = executor.execute(&step, None, cancel_flag).await;
        
        assert!(res.is_err());
    }

    #[tokio::test]
    async fn test_missing_required_input_rejected() {
        let step = PipelineStep {
            id: "step-ai".into(),
            name: "AI step".into(),
            step_type: PipelineStepType::AiAgent,
            config: StepConfig::AiAgent {
                provider_id: "openai".into(),
                model: None,
                system_prompt: None,
                user_prompt_template: "hello".into(),
            },
            order: 1,
            timeout_seconds: None,
        };
        let executor = AiStepExecutor;
        let cancel_flag = Arc::new(AtomicBool::new(false));
        
        let res = executor.execute(&step, None, cancel_flag).await;
        assert!(res.is_err());
        assert!(format!("{}", res.err().unwrap()).contains("AI Gateway is required"));
    }

    #[tokio::test]
    async fn test_ai_step_success_via_mock_gateway() {
        let temp = tempfile::tempdir().unwrap();
        let app_data_dir = temp.path().to_path_buf();
        
        let provider_config = crate::ai::models::AIProviderConfig {
            id: "openai-test".into(),
            name: "OpenAI Test".into(),
            provider_type: crate::ai::models::ProviderType::OpenAI,
            base_url: "https://api.openai.com/v1".into(),
            model: "gpt-4".into(),
            enabled: true,
            is_default: false,
            status: crate::ai::models::AIProviderStatus::Connected,
            created_at: 0,
            updated_at: 0,
            last_error: None,
        };
        
        // Persist file manually to MetadataStore dir
        let providers = vec![provider_config];
        let content = serde_json::to_string_pretty(&providers).unwrap();
        std::fs::write(app_data_dir.join("ai_providers.json"), content).unwrap();

        let credential_store = Arc::new(crate::ai::credential_store::MockCredentialStore::new());
        credential_store.save_secret("openai-test", "TEST_SECRET_DO_NOT_LEAK_123").unwrap();
        
        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Success("Mock reply from AI".into())));

        let ai_gateway = Arc::new(
            AIGateway::with_stores(app_data_dir, credential_store)
                .with_adapter_override(mock_adapter)
        );

        let step = PipelineStep {
            id: "step-ai".into(),
            name: "AI step".into(),
            step_type: PipelineStepType::AiAgent,
            config: StepConfig::AiAgent {
                provider_id: "openai-test".into(),
                model: None,
                system_prompt: Some("Sys prompt".into()),
                user_prompt_template: "Hello".into(),
            },
            order: 1,
            timeout_seconds: None,
        };

        let executor = AiStepExecutor;
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let res = executor.execute(&step, Some(&ai_gateway), cancel_flag).await.unwrap();
        
        assert_eq!(res.status, PipelineStatus::Success);
        assert_eq!(res.output, Some("Mock reply from AI".into()));
    }

    #[tokio::test]
    async fn test_result_serialization() {
        let result = StepResult {
            step_id: "step-1".into(),
            status: PipelineStatus::Success,
            output: Some("data output".into()),
            duration_ms: 120,
            error: None,
        };
        let serialized = serde_json::to_string(&result).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(parsed["stepId"], "step-1");
        assert_eq!(parsed["status"], "SUCCESS");
    }

    #[tokio::test]
    async fn test_secret_leakage_protection() {
        let temp = tempfile::tempdir().unwrap();
        let app_data_dir = temp.path().to_path_buf();
        
        let provider_config = crate::ai::models::AIProviderConfig {
            id: "openai-leak-test".into(),
            name: "OpenAI Leak".into(),
            provider_type: crate::ai::models::ProviderType::OpenAI,
            base_url: "https://api.openai.com/v1".into(),
            model: "gpt-4".into(),
            enabled: true,
            is_default: false,
            status: crate::ai::models::AIProviderStatus::Connected,
            created_at: 0,
            updated_at: 0,
            last_error: None,
        };
        
        let providers = vec![provider_config];
        let content = serde_json::to_string_pretty(&providers).unwrap();
        std::fs::write(app_data_dir.join("ai_providers.json"), content).unwrap();
        
        let credential_store = Arc::new(crate::ai::credential_store::MockCredentialStore::new());
        credential_store.save_secret("openai-leak-test", "TEST_SECRET_DO_NOT_LEAK_123").unwrap();
        
        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Error429));

        let ai_gateway = Arc::new(
            AIGateway::with_stores(app_data_dir, credential_store)
                .with_adapter_override(mock_adapter)
        );

        let step = PipelineStep {
            id: "step-ai".into(),
            name: "AI step".into(),
            step_type: PipelineStepType::AiAgent,
            config: StepConfig::AiAgent {
                provider_id: "openai-leak-test".into(),
                model: None,
                system_prompt: None,
                user_prompt_template: "Hello".into(),
            },
            order: 1,
            timeout_seconds: None,
        };

        let executor = AiStepExecutor;
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let res = executor.execute(&step, Some(&ai_gateway), cancel_flag).await.unwrap();
        
        assert_eq!(res.status, PipelineStatus::Failed);
        
        let error_msg = res.error.as_ref().unwrap();
        let serialized_res = serde_json::to_string(&res).unwrap();
        
        assert!(!error_msg.contains("TEST_SECRET_DO_NOT_LEAK_123"));
        assert!(!serialized_res.contains("TEST_SECRET_DO_NOT_LEAK_123"));
    }
}

#[cfg(test)]
mod execution_lifecycle_tests {
    use std::sync::Arc;
    use crate::pipeline::domain::*;
    use crate::pipeline::execution::context::PipelineExecutionContext;
    use crate::pipeline::execution::state_machine::{StageStatus, StepStatus};
    use crate::pipeline::execution::pipeline_executor::PipelineExecutor;
    use crate::pipeline::events::PipelineExecutionManager;
    use std::collections::HashMap;

    fn create_valid_sequential_pipeline() -> PipelineDefinition {
        PipelineDefinition {
            id: "pipe-seq".into(),
            name: "Sequential Test Pipeline".into(),
            description: None,
            version: 1,
            trigger: "manual".into(),
            stages: vec![
                PipelineStage {
                    id: "stage-1".into(),
                    name: "Stage One".into(),
                    order: 1,
                    steps: vec![
                        PipelineStep {
                            id: "step-1-1".into(),
                            name: "Step 1.1".into(),
                            step_type: PipelineStepType::Mock,
                            config: StepConfig::Mock {
                                behavior: "success".into(),
                                output: Some("output 1.1".into()),
                            },
                            order: 1,
                            timeout_seconds: None,
                        },
                        PipelineStep {
                            id: "step-1-2".into(),
                            name: "Step 1.2".into(),
                            step_type: PipelineStepType::Mock,
                            config: StepConfig::Mock {
                                behavior: "success".into(),
                                output: Some("output 1.2".into()),
                            },
                            order: 2,
                            timeout_seconds: None,
                        },
                    ],
                },
                PipelineStage {
                    id: "stage-2".into(),
                    name: "Stage Two".into(),
                    order: 2,
                    steps: vec![
                        PipelineStep {
                            id: "step-2-1".into(),
                            name: "Step 2.1".into(),
                            step_type: PipelineStepType::Mock,
                            config: StepConfig::Mock {
                                behavior: "success".into(),
                                output: Some("output 2.1".into()),
                            },
                            order: 1,
                            timeout_seconds: None,
                        },
                    ],
                },
            ],
            metadata: HashMap::new(),
        }
    }

    #[test]
    fn test_valid_pipeline_transitions() {
        let ctx = PipelineExecutionContext::new("p1".into());
        assert_eq!(ctx.get_pipeline_status(), PipelineStatus::Idle);
        
        ctx.transition_pipeline_status(PipelineStatus::Queued).unwrap();
        ctx.transition_pipeline_status(PipelineStatus::Running).unwrap();
        ctx.transition_pipeline_status(PipelineStatus::Success).unwrap();
        assert_eq!(ctx.get_pipeline_status(), PipelineStatus::Success);
    }

    #[test]
    fn test_invalid_pipeline_transitions() {
        let ctx = PipelineExecutionContext::new("p1".into());
        ctx.transition_pipeline_status(PipelineStatus::Queued).unwrap();
        ctx.transition_pipeline_status(PipelineStatus::Running).unwrap();
        ctx.transition_pipeline_status(PipelineStatus::Success).unwrap();
        
        // Success to Running should fail
        assert!(ctx.transition_pipeline_status(PipelineStatus::Running).is_err());
    }

    #[test]
    fn test_stage_step_valid_transitions() {
        let ctx = PipelineExecutionContext::new("p1".into());
        
        // Stage check
        assert_eq!(ctx.get_stage_status("s1"), StageStatus::Pending);
        ctx.transition_stage_status("s1", StageStatus::Running).unwrap();
        ctx.transition_stage_status("s1", StageStatus::Success).unwrap();
        assert_eq!(ctx.get_stage_status("s1"), StageStatus::Success);

        // Step check
        assert_eq!(ctx.get_step_status("st1"), StepStatus::Pending);
        ctx.transition_step_status("st1", StepStatus::Running).unwrap();
        ctx.transition_step_status("st1", StepStatus::Success).unwrap();
        assert_eq!(ctx.get_step_status("st1"), StepStatus::Success);
    }

    #[tokio::test]
    async fn test_pipeline_executor_success_run() {
        let pipeline = create_valid_sequential_pipeline();
        let manager = Arc::new(PipelineExecutionManager::new());
        let executor = PipelineExecutor::new(None, None, manager);
        let ctx = executor.execute(&pipeline).await.unwrap();

        assert_eq!(ctx.get_pipeline_status(), PipelineStatus::Success);
        
        // Stage transitions verified
        assert_eq!(ctx.get_stage_status("stage-1"), StageStatus::Success);
        assert_eq!(ctx.get_stage_status("stage-2"), StageStatus::Success);

        // Step transitions verified
        assert_eq!(ctx.get_step_status("step-1-1"), StepStatus::Success);
        assert_eq!(ctx.get_step_status("step-1-2"), StepStatus::Success);
        assert_eq!(ctx.get_step_status("step-2-1"), StepStatus::Success);

        // Deterministic outputs
        assert_eq!(ctx.get_step_output("step-1-1"), Some("output 1.1".into()));
        assert_eq!(ctx.get_step_output("step-1-2"), Some("output 1.2".into()));
    }

    #[tokio::test]
    async fn test_pipeline_failure_propagation() {
        let mut pipeline = create_valid_sequential_pipeline();
        // Set step 1.2 to fail
        pipeline.stages[0].steps[1].config = StepConfig::Mock {
            behavior: "failure".into(),
            output: Some("Fail test".into()),
        };

        let manager = Arc::new(PipelineExecutionManager::new());
        let executor = PipelineExecutor::new(None, None, manager);
        let ctx = executor.execute(&pipeline).await.unwrap();

        assert_eq!(ctx.get_pipeline_status(), PipelineStatus::Failed);
        
        // Stage 1 failed, Stage 2 remains Pending (not executed)
        assert_eq!(ctx.get_stage_status("stage-1"), StageStatus::Failed);
        assert_eq!(ctx.get_stage_status("stage-2"), StageStatus::Pending);

        // Step 1.1 was Success, Step 1.2 failed
        assert_eq!(ctx.get_step_status("step-1-1"), StepStatus::Success);
        assert_eq!(ctx.get_step_status("step-1-2"), StepStatus::Failed);
        assert_eq!(ctx.get_step_error("step-1-2"), Some("Fail test".into()));

        // Step 2.1 remained Pending
        assert_eq!(ctx.get_step_status("step-2-1"), StepStatus::Pending);
    }

    #[tokio::test]
    async fn test_cancellation_flow() {
        let pipeline = create_valid_sequential_pipeline();
        let ctx = Arc::new(PipelineExecutionContext::new(pipeline.id.clone()));
        ctx.cancel();
        
        assert_eq!(ctx.get_pipeline_status(), PipelineStatus::Cancelled);
        assert!(ctx.is_cancelled());
    }

    #[test]
    fn test_execution_id_uniqueness() {
        let ctx1 = PipelineExecutionContext::new("p1".into());
        let ctx2 = PipelineExecutionContext::new("p1".into());
        assert_ne!(ctx1.execution_id, ctx2.execution_id);
    }

    #[test]
    fn test_secret_leak_sanitization_in_context() {
        let ctx = PipelineExecutionContext::new("p1".into());
        
        // Secret values
        let raw_err = "Unauthorized header error: bearer sk-Proj-12345ABCDE and secret TEST_SECRET_DO_NOT_LEAK_123 key";
        ctx.record_step_result("step-1", None, Some(raw_err.into()));

        let clean_err = ctx.get_step_error("step-1").unwrap();
        
        assert!(!clean_err.contains("sk-Proj-12345ABCDE"));
        assert!(!clean_err.contains("TEST_SECRET_DO_NOT_LEAK_123"));
        assert!(clean_err.contains("[REDACTED_API_KEY]"));
        assert!(clean_err.contains("[REDACTED_SECRET]"));
    }
}

#[cfg(test)]
mod observability_tests {
    use std::sync::Arc;
    use crate::pipeline::events::{PipelineExecutionManager, PipelineEvent};
    use crate::pipeline::execution::context::PipelineExecutionContext;

    #[test]
    fn test_manager_registration_and_sequence() {
        let manager = PipelineExecutionManager::new();
        let ctx = Arc::new(PipelineExecutionContext::new("pipe-1".into()));
        manager.register_execution(ctx.clone());

        let retrieved = manager.get_execution(&ctx.execution_id).unwrap();
        assert_eq!(retrieved.execution_id, ctx.execution_id);

        assert_eq!(manager.next_sequence_number(&ctx.execution_id), 1);
        assert_eq!(manager.next_sequence_number(&ctx.execution_id), 2);
        assert_eq!(manager.next_sequence_number(&ctx.execution_id), 3);
    }

    #[test]
    fn test_lru_eviction() {
        let manager = PipelineExecutionManager::new();
        let mut ids = Vec::new();

        for i in 0..60 {
            let ctx = Arc::new(PipelineExecutionContext::new(format!("pipe-{}", i)));
            manager.register_execution(ctx.clone());
            ids.push(ctx.execution_id.clone());
            manager.mark_completed(&ctx.execution_id);
        }

        for i in 0..10 {
            assert!(manager.get_execution(&ids[i]).is_none());
        }

        for i in 10..60 {
            assert!(manager.get_execution(&ids[i]).is_some());
        }
    }

    #[test]
    fn test_event_serialization_and_secrets_safety() {
        // Simulating context sanitization
        let ctx = PipelineExecutionContext::new("p1".into());
        let clean_msg = ctx.sanitize("Failed with token sk-Proj-12345ABCDE and secret TEST_SECRET_DO_NOT_LEAK_123");
        
        let sanitized_event = PipelineEvent::PipelineFailed {
            execution_id: "run-1".into(),
            error_code: "AUTH_ERROR".into(),
            error_message: clean_msg,
            stage_id: None,
            step_id: None,
            timestamp: 1000,
            sequence_number: 1,
        };

        let serialized = serde_json::to_string(&sanitized_event).unwrap();
        
        assert!(!serialized.contains("sk-Proj-12345ABCDE"));
        assert!(!serialized.contains("TEST_SECRET_DO_NOT_LEAK_123"));
        assert!(serialized.contains("[REDACTED_API_KEY]"));
        assert!(serialized.contains("[REDACTED_SECRET]"));
    }
}


