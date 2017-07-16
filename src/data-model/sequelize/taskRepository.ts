export interface ITaskRepository {
    id: string;
    name: string;
    description: string;
    location: string;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date;
}

export const TableName = "TaskRepositories";

export function sequelizeImport(sequelize, DataTypes) {
    const TaskRepository = sequelize.define(TableName, {
        id: {
            primaryKey: true,
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4
        },
        name: {
            type: DataTypes.TEXT,
            defaultValue: ""
        },
        description: {
            type: DataTypes.TEXT,
            defaultValue: ""
        },
        location: {
            type: DataTypes.TEXT,
            defaultValue: ""
        }
    }, {
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        deletedAt: "deleted_at",
        paranoid: true
    });

    TaskRepository.associate = models => {
        TaskRepository.hasMany(models.TaskDefinitions, {foreignKey: "task_repository_id", as: "Tasks"});
    };

    return TaskRepository;
}
