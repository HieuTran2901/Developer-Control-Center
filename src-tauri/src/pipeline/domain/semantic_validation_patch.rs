                    // Rule 4: Build / Test Duplication Rule & Maven Lifecycle Awareness
                    let mvn_info = parse_maven_step(command, args);

                    if mvn_info.is_maven || cmd_lower.contains("cargo build") || cmd_lower.contains("gradle build") || cmd_lower.contains("npm run build") {
                        executed_build_steps.push((stage.id.clone(), step.id.clone(), effective_cwd.to_string(), full_cmd.clone()));
                    }

                    if mvn_info.is_maven {
                        if mvn_info.runs_tests_via_lifecycle {
                            executed_maven_test_producers.push((step.id.clone(), effective_cwd.to_string(), full_cmd.clone()));
                        } else if mvn_info.is_test_only && !mvn_info.skips_tests {
                            if let Some((prev_id, _, prev_cmd)) = executed_maven_test_producers.iter().find(|(_, c, _)| c == effective_cwd) {
                                return Err(SemanticValidationError {
                                    code: SemanticErrorCode::RedundantTest,
                                    stage_id: Some(stage.id.clone()),
                                    step_id: Some(step.id.clone()),
                                    related_step_id: Some(prev_id.clone()),
                                    message: format!(
                                        "Step '{}' executes 'mvn test', but preceding step '{}' ('{}') already runs the Maven lifecycle including tests.",
                                        step.id, prev_id, prev_cmd
                                    ),
                                    evidence: Some(format!("Preceding step '{}' ran '{}'", prev_id, prev_cmd)),
                                    suggestion: Some(
                                        "Remove redundant test step or use a build command with tests explicitly skipped if a separate test phase is required.".to_string()
                                    ),
                                });
                            }
                        }
                    }

                    // Check duplicate commands in same cwd
                    let cmd_key = format!("{}:{}", effective_cwd, full_cmd);
                    if let Some(prev_step_id) = executed_commands.insert(cmd_key, step.id.clone()) {
                        return Err(SemanticValidationError {
                            code: SemanticErrorCode::RedundantBuild,
                            stage_id: Some(stage.id.clone()),
                            step_id: Some(step.id.clone()),
                            related_step_id: Some(prev_step_id.clone()),
                            message: format!("Duplicate command '{}' executed in step '{}', previously executed in step '{}'.", full_cmd, step.id, prev_step_id),
                            evidence: Some(format!("Identical command executed in step '{}'", prev_step_id)),
                            suggestion: Some("Remove redundant step to optimize pipeline execution.".to_string()),
                        });
                    }
                }

                StepConfig::Artifact { path, artifact_name } => {
                    // Check Rule 6: Every artifact must have a valid producer
                    if executed_build_steps.is_empty() {
                        return Err(SemanticValidationError {
                            code: SemanticErrorCode::ArtifactProducerMissing,
                            stage_id: Some(stage.id.clone()),
                            step_id: Some(step.id.clone()),
                            related_step_id: None,
                            message: format!("Artifact step '{}' ('{}') is defined without any preceding build/package step in the pipeline.", step.id, artifact_name),
                            evidence: Some(format!("Artifact path: '{}'", path)),
                            suggestion: Some("Add a build or package step prior to artifact collection.".to_string()),
                        });
                    }

                    // Check for CROSS JOB WORKSPACE issues
                    let mut found_producer_in_same_stage = false;
                    let mut found_producer_in_different_stage = false;
                    let mut related_producer_step = None;
                    
                    for (prod_stage_id, prod_step_id, prod_cwd, _cmd) in executed_build_steps.iter().rev() {
                        let is_related = prod_cwd == "." || path.starts_with(&format!("{}/", prod_cwd)) || path.starts_with(prod_cwd);
                        if is_related {
                            if prod_stage_id == &stage.id {
                                found_producer_in_same_stage = true;
                                related_producer_step = Some(prod_step_id.clone());
                                break;
                            } else {
                                found_producer_in_different_stage = true;
                                related_producer_step = Some(prod_step_id.clone());
                            }
                        }
                    }

                    if !found_producer_in_same_stage {
                        if found_producer_in_different_stage {
                            return Err(SemanticValidationError {
                                code: SemanticErrorCode::ArtifactCrossJobWorkspace,
                                stage_id: Some(stage.id.clone()),
                                step_id: Some(step.id.clone()),
                                related_step_id: related_producer_step,
                                message: format!("Artifact step '{}' consumes files produced in a different stage (job) without an artifact transfer.", step.id),
                                evidence: Some(format!("Artifact path: '{}' in stage '{}'", path, stage.id)),
                                suggestion: Some("Move the upload-artifact step into the producer job or explicitly model an artifact transfer.".to_string()),
                            });
                        } else {
                            return Err(SemanticValidationError {
                                code: SemanticErrorCode::ArtifactPathNotProduced,
                                stage_id: Some(stage.id.clone()),
                                step_id: Some(step.id.clone()),
                                related_step_id: None,
                                message: format!("Artifact step '{}' specifies path '{}', but no preceding build step produced outputs in this path.", step.id, path),
                                evidence: Some(format!("Path: '{}'", path)),
                                suggestion: Some("Ensure the artifact path matches the output directory of a preceding build step.".to_string()),
                            });
                        }
                    }

                    // Check path consistency
                    if path.starts_with('/') || (path.len() >= 2 && path.chars().nth(1) == Some(':')) {
                        return Err(SemanticValidationError {
                            code: SemanticErrorCode::InconsistentPathReference,
                            stage_id: Some(stage.id.clone()),
                            step_id: Some(step.id.clone()),
                            related_step_id: None,
                            message: format!("Artifact step '{}' specifies absolute path '{}'. Artifact paths must be repository-relative.", step.id, path),
                            evidence: Some(path.clone()),
                            suggestion: Some("Use relative path e.g. 'Backend/target/*.jar' or 'dist'.".to_string()),
                        });
                    }
                    if path.contains("../") {
                        return Err(SemanticValidationError {
                            code: SemanticErrorCode::InconsistentPathReference,
                            stage_id: Some(stage.id.clone()),
                            step_id: Some(step.id.clone()),
                            related_step_id: None,
                            message: format!("Artifact step '{}' specifies traversal path '{}'. Artifact paths must be repository-relative and not traverse upwards.", step.id, path),
                            evidence: Some(path.clone()),
                            suggestion: Some("Use purely repository-relative paths without '../' traversal.".to_string()),
                        });
                    }
                }
                _ => {}
            }
        }
    }
