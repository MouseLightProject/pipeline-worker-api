let typeDefinitions = `    
interface ITimestamps {
  created_at: String
  updated_at: String
  deleted_at: String
}

type TaskDefinition implements ITimestamps {
  id: String!
  name: String!
  description: String!
  script: String!
  interpreter: String!
  created_at: String
  updated_at: String
  deleted_at: String
}

type TaskExecution implements ITimestamps {
  id: String!
  resolved_script: String
  resolved_interpreter: String
  execution_status_code: Int
  completion_status_code: Int
  machine_id: String
  started_at: String
  completed_at: String
  script_args: String
  last_process_status_code: Float
  max_memory: Float
  max_cpu: Float  
  task_id: String
  created_at: String
  updated_at: String
  deleted_at: String
}

type Query {
  taskDefinitions: [TaskDefinition!]!
  taskExecutions: [TaskExecution!]!
  taskExecution(id: String!): TaskExecution
  runningTasks: [TaskExecution!]!
}

type Mutation {
  debugMessage(msg: String!): String!
  startTask(taskDefinitionId: String!, scriptArgs: [String!]): TaskExecution
  stopTask(taskExecutionId: String!, forceIfNeeded: Boolean = false): TaskExecution
  refreshTasksFromProcessManager: [TaskExecution!]
  refreshTaskFromProcessManager(taskExecutionId: String!): TaskExecution
  clearAllCompleteExecutions: Int
}

schema {
  query: Query
  mutation: Mutation
}
`;

export default typeDefinitions;
