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
  args: String!
  work_units: Float!
  created_at: String
  updated_at: String
  deleted_at: String
}

type TaskExecution implements ITimestamps {
  id: String!
  machine_id: String
  task_id: String
  task: TaskDefinition
  work_units: Float
  resolved_script: String
  resolved_interpreter: String
  resolved_args: String
  execution_status_code: Int
  completion_status_code: Int
  last_process_status_code: Float
  max_memory: Float
  max_cpu: Float
  exit_code: Int
  started_at: String
  completed_at: String
  created_at: String
  updated_at: String
  deleted_at: String
}

type TaskStatistics implements ITimestamps {
  id: String!
  task_id: String
  task: TaskDefinition
  num_execute: Int
  num_complete: Int
  num_error: Int
  num_cancel: Int
  cpu_average: Float
  cpu_high: Float
  cpu_low: Float
  memory_average: Float
  memory_high: Float
  memory_low: Float
  duration_average: Float
  duration_high: Float
  duration_low: Float
  created_at: String
  updated_at: String
  deleted_at: String
}

input TaskDefinitionInput {
  id: String
  name: String
  description: String
  script: String
  interpreter: String
  args: String
  work_units: Float
}

type Query {
  taskDefinitions: [TaskDefinition!]!
  taskStatistics: [TaskStatistics!]!
  taskExecutions: [TaskExecution!]!
  taskExecution(id: String!): TaskExecution
  taskStatistics: [TaskStatistics!]!
  statisticsForTask(id: String): TaskStatistics
  runningTasks: [TaskExecution!]!
  workUnitCapacity: Float
}

type Mutation {
  debugMessage(msg: String!): String!
  updateTaskDefinition(taskDefinition: TaskDefinitionInput): TaskDefinition
  startTask(taskDefinitionId: String!, scriptArgs: [String!]): TaskExecution
  stopTask(taskExecutionId: String!): TaskExecution
  refreshTasksFromProcessManager: [TaskExecution!]
  refreshTaskFromProcessManager(taskExecutionId: String!): TaskExecution
  removeCompletedExecutionsWithCode(code: Int): Int
  resetStatistics(taskId: String): Int
}

schema {
  query: Query
  mutation: Mutation
}
`;

export default typeDefinitions;
