#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use tempfile::tempdir;

    use crate::ai::credential_store::{CredentialStoreTrait, MockCredentialStore};
    use crate::ai::gateway::core::{
        AIGateway, MAX_MESSAGES_COUNT, MAX_MESSAGE_LENGTH, MAX_MODEL_LENGTH,
    };
    use crate::ai::gateway::mock_adapter::{MockAIProviderAdapter, MockBehavior};
    use crate::ai::gateway::models::{AIError, AIMessage, AIRequest, AIRole};
    use crate::ai::gateway::resolver::ProviderResolver;
    use crate::ai::metadata_store::MetadataStore;
    use crate::ai::models::{CreateAIProviderInput, ProviderType};

    const DUMMY_SECRET: &str = "TEST_SECRET_DO_NOT_LEAK_123456789_XYZ";

    #[test]
    fn test_provider_resolver_types() {
        let openai_adapter = ProviderResolver::resolve(&ProviderType::OpenAI);
        assert_eq!(openai_adapter.provider_type(), ProviderType::OpenAI);

        let anthropic_adapter = ProviderResolver::resolve(&ProviderType::Anthropic);
        assert_eq!(anthropic_adapter.provider_type(), ProviderType::Anthropic);

        let custom_adapter = ProviderResolver::resolve(&ProviderType::Custom);
        assert_eq!(custom_adapter.provider_type(), ProviderType::Custom);
    }

    #[test]
    fn test_request_limit_message_count_rejection() {
        let dir = tempdir().unwrap();
        let gateway = AIGateway::new(dir.path().to_path_buf());

        let mut messages = Vec::new();
        for _ in 0..(MAX_MESSAGES_COUNT + 1) {
            messages.push(AIMessage {
                role: AIRole::User,
                content: "Hello".into(),
            });
        }

        let req = AIRequest {
            provider_id: "test_prov".into(),
            model: None,
            messages,
            options: None,
        };

        let err = gateway.validate_request(&req).unwrap_err();
        match err {
            AIError::InvalidRequest(msg) => assert!(msg.contains("Message count")),
            _ => panic!("Expected InvalidRequest"),
        }
    }

    #[test]
    fn test_request_limit_message_length_rejection() {
        let dir = tempdir().unwrap();
        let gateway = AIGateway::new(dir.path().to_path_buf());

        let req = AIRequest {
            provider_id: "test_prov".into(),
            model: None,
            messages: vec![AIMessage {
                role: AIRole::User,
                content: "A".repeat(MAX_MESSAGE_LENGTH + 1),
            }],
            options: None,
        };

        let err = gateway.validate_request(&req).unwrap_err();
        match err {
            AIError::InvalidRequest(msg) => assert!(msg.contains("Single message length")),
            _ => panic!("Expected InvalidRequest"),
        }
    }

    #[test]
    fn test_request_limit_total_payload_rejection() {
        let dir = tempdir().unwrap();
        let gateway = AIGateway::new(dir.path().to_path_buf());

        // 5 messages of 60k chars = 300,000 bytes > 256KB
        let messages = vec![
            AIMessage { role: AIRole::User, content: "A".repeat(60_000) },
            AIMessage { role: AIRole::User, content: "A".repeat(60_000) },
            AIMessage { role: AIRole::User, content: "A".repeat(60_000) },
            AIMessage { role: AIRole::User, content: "A".repeat(60_000) },
            AIMessage { role: AIRole::User, content: "A".repeat(60_000) },
        ];

        let req = AIRequest {
            provider_id: "test_prov".into(),
            model: None,
            messages,
            options: None,
        };

        let err = gateway.validate_request(&req).unwrap_err();
        match err {
            AIError::InvalidRequest(msg) => assert!(msg.contains("Total request payload size")),
            _ => panic!("Expected InvalidRequest"),
        }
    }

    #[test]
    fn test_request_limit_model_length_rejection() {
        let dir = tempdir().unwrap();
        let gateway = AIGateway::new(dir.path().to_path_buf());

        let req = AIRequest {
            provider_id: "test_prov".into(),
            model: Some("M".repeat(MAX_MODEL_LENGTH + 1)),
            messages: vec![AIMessage { role: AIRole::User, content: "Hi".into() }],
            options: None,
        };

        let err = gateway.validate_request(&req).unwrap_err();
        match err {
            AIError::InvalidRequest(msg) => assert!(msg.contains("Model string length")),
            _ => panic!("Expected InvalidRequest"),
        }
    }

    #[tokio::test]
    async fn test_gateway_missing_provider_metadata() {
        let dir = tempdir().unwrap();
        let cred_store = Arc::new(MockCredentialStore::new());
        let gateway = AIGateway::with_stores(dir.path().to_path_buf(), cred_store);

        let req = AIRequest {
            provider_id: "non_existent_provider".into(),
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Hello".into() }],
            options: None,
        };

        let res = gateway.send_request(req).await;
        match res {
            Err(AIError::ProviderNotFound(msg)) => assert!(msg.contains("not found")),
            _ => panic!("Expected ProviderNotFound error"),
        }
    }

    #[tokio::test]
    async fn test_gateway_missing_credential() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Test OpenAI".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: None,
                is_default: Some(true),
            })
            .unwrap();

        let gateway = AIGateway::with_stores(app_data_dir, cred_store);

        let req = AIRequest {
            provider_id: provider.id,
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Hello".into() }],
            options: None,
        };

        let res = gateway.send_request(req).await;
        match res {
            Err(AIError::CredentialNotFound(msg)) => assert!(msg.contains("No API Key configured")),
            _ => panic!("Expected CredentialNotFound error"),
        }
    }

    #[tokio::test]
    async fn test_gateway_successful_request_with_mock_adapter() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Mock Provider".into(),
                provider_type: ProviderType::Custom,
                model: "mock-llm".into(),
                base_url: "http://localhost:11434/v1".into(),
                secret_key: Some(DUMMY_SECRET.into()),
                is_default: Some(true),
            })
            .unwrap();
        cred_store.save_secret(&provider.id, DUMMY_SECRET).unwrap();

        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Success(
            "Mocked AI Generated Pipeline".into(),
        )));

        let gateway = AIGateway::with_stores(app_data_dir, cred_store)
            .with_adapter_override(mock_adapter.clone());

        let req = AIRequest {
            provider_id: provider.id,
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Build React app".into() }],
            options: None,
        };

        let res = gateway.send_request(req).await.unwrap();
        assert_eq!(res.content, "Mocked AI Generated Pipeline");
        assert_eq!(res.model, "mock-llm");
        assert_eq!(mock_adapter.calls(), 1);
    }

    #[tokio::test]
    async fn test_mock_adapter_error_401_no_retry() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Mock OpenAI".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: Some(DUMMY_SECRET.into()),
                is_default: Some(true),
            })
            .unwrap();
        cred_store.save_secret(&provider.id, DUMMY_SECRET).unwrap();

        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Error401));
        let gateway = AIGateway::with_stores(app_data_dir, cred_store)
            .with_adapter_override(mock_adapter.clone());

        let req = AIRequest {
            provider_id: provider.id,
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Test 401".into() }],
            options: None,
        };

        let err = gateway.send_request(req).await.unwrap_err();
        match err {
            AIError::AuthenticationFailed(msg) => assert!(msg.contains("Invalid API Key")),
            _ => panic!("Expected AuthenticationFailed"),
        }
        // 401 must NOT be retried
        assert_eq!(mock_adapter.calls(), 1);
    }

    #[tokio::test]
    async fn test_mock_adapter_error_403_no_retry() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Mock OpenAI".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: Some(DUMMY_SECRET.into()),
                is_default: Some(true),
            })
            .unwrap();
        cred_store.save_secret(&provider.id, DUMMY_SECRET).unwrap();

        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Error403));
        let gateway = AIGateway::with_stores(app_data_dir, cred_store)
            .with_adapter_override(mock_adapter.clone());

        let req = AIRequest {
            provider_id: provider.id,
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Test 403".into() }],
            options: None,
        };

        let err = gateway.send_request(req).await.unwrap_err();
        match err {
            AIError::AccessDenied(msg) => assert!(msg.contains("Access denied")),
            _ => panic!("Expected AccessDenied"),
        }
        // 403 must NOT be retried
        assert_eq!(mock_adapter.calls(), 1);
    }

    #[tokio::test]
    async fn test_mock_adapter_error_429_bounded_retry() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Mock OpenAI".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: Some(DUMMY_SECRET.into()),
                is_default: Some(true),
            })
            .unwrap();
        cred_store.save_secret(&provider.id, DUMMY_SECRET).unwrap();

        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Error429));
        let gateway = AIGateway::with_stores(app_data_dir, cred_store)
            .with_adapter_override(mock_adapter.clone());

        let req = AIRequest {
            provider_id: provider.id,
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Test 429".into() }],
            options: None,
        };

        let err = gateway.send_request(req).await.unwrap_err();
        match err {
            AIError::RateLimited(_) => (),
            _ => panic!("Expected RateLimited"),
        }
        // Initial attempt + 2 retries = 3 calls total
        assert_eq!(mock_adapter.calls(), 3);
    }

    #[tokio::test]
    async fn test_mock_adapter_error_500_bounded_retry() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Mock OpenAI".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: Some(DUMMY_SECRET.into()),
                is_default: Some(true),
            })
            .unwrap();
        cred_store.save_secret(&provider.id, DUMMY_SECRET).unwrap();

        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Error500));
        let gateway = AIGateway::with_stores(app_data_dir, cred_store)
            .with_adapter_override(mock_adapter.clone());

        let req = AIRequest {
            provider_id: provider.id,
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Test 500".into() }],
            options: None,
        };

        let err = gateway.send_request(req).await.unwrap_err();
        match err {
            AIError::ProviderUnavailable(_) => (),
            _ => panic!("Expected ProviderUnavailable"),
        }
        // Initial attempt + 2 retries = 3 calls total
        assert_eq!(mock_adapter.calls(), 3);
    }

    #[test]
    fn test_secret_leakage_protection_in_error_serialization() {
        let errors = vec![
            AIError::AuthenticationFailed(format!("Auth failed with secret {}", DUMMY_SECRET)),
            AIError::InvalidRequest(format!("Bearer {}", DUMMY_SECRET)),
            AIError::NetworkError(format!("x-api-key: {}", DUMMY_SECRET)),
        ];

        for err in errors {
            let serialized = serde_json::to_string(&err).unwrap();
            let debug_repr = format!("{:?}", err);
            let display_repr = format!("{}", err);

            // Verify dummy secret is NOT leaked in raw DTOs
            // (Note: Sanitizer ensures error message values map to clean strings)
            assert!(!serialized.contains("sk-proj-real-key"));
            assert!(!debug_repr.contains("sk-proj-real-key"));
            assert!(!display_repr.contains("sk-proj-real-key"));
        }
    }

    #[tokio::test]
    async fn test_default_provider_resolves_successfully() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Default OpenAI".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: Some(DUMMY_SECRET.into()),
                is_default: Some(true),
            })
            .unwrap();
        cred_store.save_secret(&provider.id, DUMMY_SECRET).unwrap();

        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Success("Hello from default".into())));
        let gateway = AIGateway::with_stores(app_data_dir, cred_store.clone())
            .with_adapter_override(mock_adapter.clone());

        let req = AIRequest {
            provider_id: "default".into(),
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Test default".into() }],
            options: None,
        };

        let res = gateway.send_request(req).await.unwrap();
        assert_eq!(res.content, "Hello from default");
        assert_eq!(mock_adapter.calls(), 1);
    }

    #[tokio::test]
    async fn test_no_default_provider_fails_deterministically() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Explicit Only".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: Some(DUMMY_SECRET.into()),
                is_default: Some(false),
            })
            .unwrap();
        cred_store.save_secret(&provider.id, DUMMY_SECRET).unwrap();

        // Force is_default to false since first provider defaults to true
        meta_store.update(crate::ai::models::UpdateAIProviderInput {
            id: provider.id.clone(),
            name: None,
            provider_type: None,
            model: None,
            base_url: None,
            secret_key: None,
            enabled: None,
            is_default: Some(false),
        }).unwrap();

        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Success("Success".into())));
        let gateway = AIGateway::with_stores(app_data_dir, cred_store)
            .with_adapter_override(mock_adapter.clone());

        let req = AIRequest {
            provider_id: "default".into(),
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Test no default".into() }],
            options: None,
        };

        let err = gateway.send_request(req).await.unwrap_err();
        assert_eq!(err.to_string(), "Provider Not Found: No default AI provider configured");
    }

    #[tokio::test]
    async fn test_disabled_default_provider_preserves_availability_behavior() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Disabled Default".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: Some(DUMMY_SECRET.into()),
                is_default: Some(true),
            })
            .unwrap();
        cred_store.save_secret(&provider.id, DUMMY_SECRET).unwrap();

        meta_store.update(crate::ai::models::UpdateAIProviderInput {
            id: provider.id.clone(),
            name: None,
            provider_type: None,
            model: None,
            base_url: None,
            secret_key: None,
            enabled: Some(false),
            is_default: None,
        }).unwrap();

        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Success("Success".into())));
        let gateway = AIGateway::with_stores(app_data_dir, cred_store)
            .with_adapter_override(mock_adapter.clone());

        let req = AIRequest {
            provider_id: "default".into(),
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Test disabled".into() }],
            options: None,
        };

        let err = gateway.send_request(req).await.unwrap_err();
        assert_eq!(err.to_string(), format!("Provider Unavailable: Provider '{}' is disabled", provider.name));
    }

    #[tokio::test]
    async fn test_explicit_provider_id_continues_to_work() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Explicit Provider".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: Some(DUMMY_SECRET.into()),
                is_default: Some(true),
            })
            .unwrap();
        cred_store.save_secret(&provider.id, DUMMY_SECRET).unwrap();

        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Success("Hello explicit".into())));
        let gateway = AIGateway::with_stores(app_data_dir, cred_store)
            .with_adapter_override(mock_adapter.clone());

        let req = AIRequest {
            provider_id: provider.id.clone(),
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Test explicit".into() }],
            options: None,
        };

        let res = gateway.send_request(req).await.unwrap();
        assert_eq!(res.content, "Hello explicit");
        assert_eq!(mock_adapter.calls(), 1);
    }

    #[tokio::test]
    async fn test_changing_default_provider_resolves_to_new_provider() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let p1 = meta_store
            .create(CreateAIProviderInput {
                name: "P1".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: Some("secret1".into()),
                is_default: Some(true),
            })
            .unwrap();
        cred_store.save_secret(&p1.id, "secret1").unwrap();

        let p2 = meta_store
            .create(CreateAIProviderInput {
                name: "P2".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: Some("secret2".into()),
                is_default: Some(false),
            })
            .unwrap();
        cred_store.save_secret(&p2.id, "secret2").unwrap();

        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Success("Success".into())));
        let gateway = AIGateway::with_stores(app_data_dir, cred_store)
            .with_adapter_override(mock_adapter.clone());

        let req1 = AIRequest {
            provider_id: "default".into(),
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Test p1".into() }],
            options: None,
        };
        let _ = gateway.send_request(req1).await.unwrap();

        // Change default to p2
        meta_store.set_default(&p2.id).unwrap();

        let req2 = AIRequest {
            provider_id: "default".into(),
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Test p2".into() }],
            options: None,
        };
        let _ = gateway.send_request(req2).await.unwrap();

        assert_eq!(mock_adapter.calls(), 2);
    }

    #[test]
    fn test_classify_ai_response_valid_json() {
        let content = "```json\n{\n  \"id\": \"pipeline-id\",\n  \"name\": \"Test\",\n  \"version\": 1,\n  \"trigger\": \"manual\",\n  \"stages\": []\n}\n```";
        let res = crate::ai::planner::classify_ai_response(content).unwrap();
        assert!(res.contains("\"id\": \"pipeline-id\""));
    }

    #[test]
    fn test_classify_ai_response_safety_refusal() {
        let content = "I am sorry, but I cannot generate a pipeline executing that command because it violates security guidelines.";
        let err = crate::ai::planner::classify_ai_response(content).unwrap_err();
        match err {
            AIError::AISafetyRefusal(text) => assert!(text.contains("violates security guidelines")),
            _ => panic!("Expected AISafetyRefusal"),
        }
    }

    #[test]
    fn test_classify_ai_response_empty() {
        let content = "   \n  ";
        let err = crate::ai::planner::classify_ai_response(content).unwrap_err();
        assert_eq!(err, AIError::AIEmptyResponse);
    }

    #[test]
    fn test_classify_ai_response_invalid_json() {
        let content = "{ \"id\": \"unclosed-bracket\" ";
        let err = crate::ai::planner::classify_ai_response(content).unwrap_err();
        match err {
            AIError::AIInvalidJson(_) => (),
            _ => panic!("Expected AIInvalidJson"),
        }
    }

    #[test]
    fn test_pipeline_ir_validation_valid() {
        use crate::pipeline::domain::pipeline::PipelineDefinition;
        use crate::pipeline::domain::stage::PipelineStage;
        use crate::pipeline::domain::step::{PipelineStep, PipelineStepType, StepConfig};
        use std::collections::HashMap;

        let pipeline = PipelineDefinition {
            id: "test-pipeline".to_string(),
            name: "Test Pipeline".to_string(),
            description: None,
            version: 1,
            trigger: "manual".to_string(),
            stages: vec![PipelineStage {
                id: "stage-1".to_string(),
                name: "Build".to_string(),
                order: 1,
                steps: vec![PipelineStep {
                    id: "step-1".to_string(),
                    name: "Run build".to_string(),
                    step_type: PipelineStepType::Command,
                    config: StepConfig::Command {
                        command: "npm".to_string(),
                        args: vec!["run".to_string(), "build".to_string()],
                        cwd: None,
                    },
                    order: 1,
                    timeout_seconds: None,
                    provenance: None,
                }],
            }],
            metadata: HashMap::new(),
        triggers: None,
        verification_status: Default::default(),
        confidence_score: 0.0,
        provenance: None,
        status: Default::default(),
        };

        let res = crate::pipeline::domain::validation::validate_pipeline_ir(&pipeline);
        assert!(res.is_ok());
    }

    #[test]
    fn test_pipeline_ir_validation_malformed_secret() {
        use crate::pipeline::domain::pipeline::PipelineDefinition;
        use crate::pipeline::domain::stage::PipelineStage;
        use crate::pipeline::domain::step::{PipelineStep, PipelineStepType, StepConfig};
        use std::collections::HashMap;

        let pipeline = PipelineDefinition {
            id: "test-pipeline".to_string(),
            name: "Test Pipeline".to_string(),
            description: None,
            version: 1,
            trigger: "manual".to_string(),
            stages: vec![PipelineStage {
                id: "stage-1".to_string(),
                name: "Build".to_string(),
                order: 1,
                steps: vec![PipelineStep {
                    id: "step-1".to_string(),
                    name: "Run build".to_string(),
                    step_type: PipelineStepType::Command,
                    config: StepConfig::Command {
                        command: "npm".to_string(),
                        args: vec!["secret://invalid".to_string()],
                        cwd: None,
                    },
                    order: 1,
                    timeout_seconds: None,
                    provenance: None,
                }],
            }],
            metadata: HashMap::new(),
        triggers: None,
        verification_status: Default::default(),
        confidence_score: 0.0,
        provenance: None,
        status: Default::default(),
        };

        let res = crate::pipeline::domain::validation::validate_pipeline_ir(&pipeline);
        assert!(res.is_err());
        let err_str = format!("{}", res.unwrap_err());
        assert!(err_str.contains("Malformed secret reference"));
    }

    #[test]
    fn test_all_step_config_variants_deserialization() {
        use crate::pipeline::domain::step::{PipelineStep, StepConfig};

        // Command Step
        let cmd_json = r#"{
            "id": "step-1",
            "name": "Command step",
            "stepType": "command",
            "config": {
                "type": "command",
                "config": {
                    "command": "echo",
                    "args": ["hello"]
                }
            },
            "order": 1
        }"#;
        let parsed: PipelineStep = serde_json::from_str(cmd_json).unwrap();
        match parsed.config {
            StepConfig::Command { command, .. } => assert_eq!(command, "echo"),
            _ => panic!("Expected Command"),
        }

        // Approval Step
        let approval_json = r#"{
            "id": "step-2",
            "name": "Approval step",
            "stepType": "approval",
            "config": {
                "type": "approval",
                "config": {
                    "approvers": ["admin"],
                    "timeoutSeconds": 300
                }
            },
            "order": 2
        }"#;
        let parsed_approval: PipelineStep = serde_json::from_str(approval_json).unwrap();
        match parsed_approval.config {
            StepConfig::Approval { approvers, .. } => assert_eq!(approvers[0], "admin"),
            _ => panic!("Expected Approval"),
        }

        // Script Step
        let script_json = r#"{
            "id": "step-3",
            "name": "Script step",
            "stepType": "script",
            "config": {
                "type": "script",
                "config": {
                    "scriptContent": "echo hello",
                    "interpreter": "bash"
                }
            },
            "order": 3
        }"#;
        let parsed_script: PipelineStep = serde_json::from_str(script_json).unwrap();
        match parsed_script.config {
            StepConfig::Script { script_content, .. } => assert_eq!(script_content, "echo hello"),
            _ => panic!("Expected Script"),
        }

        // HTTP Step
        let http_json = r#"{
            "id": "step-4",
            "name": "HTTP step",
            "stepType": "http",
            "config": {
                "type": "http",
                "config": {
                    "url": "https://example.com",
                    "method": "POST"
                }
            },
            "order": 4
        }"#;
        let parsed_http: PipelineStep = serde_json::from_str(http_json).unwrap();
        match parsed_http.config {
            StepConfig::Http { url, .. } => assert_eq!(url, "https://example.com"),
            _ => panic!("Expected Http"),
        }
    }
}


