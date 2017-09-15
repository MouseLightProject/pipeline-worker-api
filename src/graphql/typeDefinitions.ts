let typeDefinitions = `

type PageInfo {
    endCursor: String
    hasNextPage: Boolean
}

type ExecutionEdge {
    node: TaskExecution
    cursor: String
}

type ExecutionConnection {
    totalCount: Int
    pageInfo: PageInfo
    edges: [ExecutionEdge]
}

type ExecutionPage {
    offset: Int
    limit: Int
    totalCount: Int
    hasNextPage: Boolean
    items: [TaskExecution]
}

type TaskDefinition {
  id: String!
  name: String!
  description: String!
  script: String!
  interpreter: String!
  args: String!
  work_units: Float!
  created_at: Float
  updated_at: Float
  deleted_at: Float
}

type TaskExecution {
  id: String!
  worker_id: String
  task_definition_id: String
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
  started_at: Float
  completed_at: Float
  created_at: Float
  updated_at: Float
  deleted_at: Float
}

type TaskStatistics {
  id: String!
  task_definition_id: String
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

type Worker {
  id: String
  preferred_network_interface_id: String
  display_name: String
  work_capacity: Float
  is_cluster_proxy: Boolean
  is_accepting_jobs: Boolean
  created_at: String
  updated_at: String
  deleted_at: String
}

input WorkerInput {
  id: String
  preferred_network_interface_id: String
  display_name: String
  work_capacity: Float
  is_cluster_proxy: Boolean
  is_accepting_jobs: Boolean
}

type Query {
  taskDefinitions: [TaskDefinition!]!
  taskDefinition(id: String!): TaskDefinition
  taskExecution(id: String!): TaskExecution
  taskExecutions: [TaskExecution!]!
  taskExecutionPage(offset: Int, limit: Int): ExecutionPage
  taskExecutionConnections(first: Int, after: String): ExecutionConnection
  taskStatistics: [TaskStatistics!]!
  statisticsForTask(id: String): TaskStatistics
  runningTasks: [TaskExecution!]!
  worker: Worker
  workUnitCapacity: Float
}

type Mutation {
  updateWorker(worker: WorkerInput): Worker

  startTask(taskDefinitionId: String!,pipelineStageId: String!, tileId: String!, scriptArgs: [String!]): TaskExecution
  stopTask(taskExecutionId: String!): TaskExecution

  removeCompletedExecutionsWithCode(code: Int): Int

  resetStatistics(taskId: String): Int
}

schema {
  query: Query
  mutation: Mutation
}
`;

export default typeDefinitions;
