import * as fs from "fs";
import * as gulp from "gulp";
import * as shell from "gulp-shell";

const contents = fs.readFileSync("./package.json").toString();

const npmPackage = JSON.parse(contents);

const version = npmPackage.version;
const repo = npmPackage.dockerRepository;
const imageName = npmPackage.dockerImageName || npmPackage.name;

const dockerRepoImage = `${repo}/${imageName}`;

const imageWithVersion = `${dockerRepoImage}:${version}`;
const imageAsLatest = `${dockerRepoImage}:latest`;

const dockerBuildCommand = `docker build --tag ${imageWithVersion} .`;
const dockerTagCommand = `docker tag ${imageWithVersion} ${imageAsLatest}`;

const pushCommand = `docker push ${imageWithVersion}`;
const pushLatestCommand = `docker push ${imageAsLatest}`;

const cleanCommand = `rm -rf dist`;

const compileTypescript = `tsc -p tsconfig.prod.json`;

const moveFiles = `cp ./{package.json,yarn.lock,knexfile.js,LICENSE,docker-entry.sh,migrate.sh} dist`;
const moveTestFiles = `cp -R test dist/`;
const moveMigrations = `cp -R knex-migrations dist/`;

gulp.task("default", ["docker-build"]);

gulp.task("docker-release", ["docker-push"]);


gulp.task("build", shell.task([
        cleanCommand,
        compileTypescript,
        moveFiles,
        moveMigrations,
        moveTestFiles
    ])
);

gulp.task("docker-build", ["build"], shell.task([
        dockerBuildCommand,
        dockerTagCommand
    ])
);

gulp.task("docker-push", ["docker-build"], shell.task([
        pushCommand,
        pushLatestCommand
    ])
);
