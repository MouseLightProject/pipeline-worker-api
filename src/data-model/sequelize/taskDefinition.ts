import * as path from "path";

export interface ITaskDefinition {
    id: string;
    name: string;
    description: string;
    script: string;
    interpreter: string;
    args: string;
    expected_exit_code: number;
    work_units: number;
    task_repository_id: string;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date;

    getFullScriptPath(): Promise<string>;
}

export const TableName = "TaskDefinitions";

export function sequelizeImport(sequelize, DataTypes) {
    let TaskRepositories: any = null;

    const TaskDefinition = sequelize.define(TableName, {
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
        script: {
            type: DataTypes.TEXT,
            defaultValue: ""
        },
        interpreter: {
            type: DataTypes.TEXT,
            defaultValue: ""
        },
        args: {
            type: DataTypes.TEXT,
            defaultValue: ""
        },
        expected_exit_code: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        work_units: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        deletedAt: "deleted_at",
        paranoid: true
    });

    TaskDefinition.associate = models => {
        TaskDefinition.belongsTo(models.TaskRepositories, {foreignKey: "task_repository_id"});

        TaskRepositories = models.TaskRepositories;
    };

    TaskDefinition.prototype.getFullScriptPath = async function(): Promise<string> {
        let scriptPath = this.script;

        if (this.task_repository_id) {
            const repo = await TaskRepositories.findById(this.task_repository_id);

            scriptPath = path.join(repo.location, scriptPath);
        } else {
            if (!path.isAbsolute(scriptPath)) {
                scriptPath = path.join(process.cwd(), scriptPath);
            }
        }

        return scriptPath;
    };

    return TaskDefinition;
}
