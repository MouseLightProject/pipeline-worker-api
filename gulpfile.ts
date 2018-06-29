import * as fs from "fs";
import * as gulp from "gulp";
import * as shell from "gulp-shell";

const contents = fs.readFileSync("./package.json").toString();

const npmPackage = JSON.parse(contents);

const version = npmPackage.version;
const [versionMajor, versionMajMin] = versionMajorMinor(version);
const repo = npmPackage.dockerRepository;
const imageName = npmPackage.dockerImageName || npmPackage.name;

const dockerRepoImage = `${repo}/${imageName}`;

///
//  The objective here is to build and tag the actual version, mark it as latest, and also tag it with just the major
//  version and major.minor as the "latest" within those scopes.  Iterations of deploy-services should generally use
//  major.minor in the Compose file rather that just latest.  This facilitates side-by-side deployments of current and
//  next version systems where pulling "latest" doesn't affect the older system on subsequent up commands.
///

const imageWithVersion = `${dockerRepoImage}:${version}`;
const imageWithVersionMajor = versionMajor ? `${dockerRepoImage}:${versionMajor}` : null;
const imageWithVersionMajMin = versionMajMin ? `${dockerRepoImage}:${versionMajMin}` : null;
const imageAsLatest = `${dockerRepoImage}:latest`;

const buildCommand = `docker build --tag ${imageWithVersion} .`;
const tagMajorCommand = imageWithVersionMajor ? `docker tag ${imageWithVersion} ${imageWithVersionMajor}` : `echo "could not tag with major version"`;
const tagMajMinCommand = imageWithVersionMajMin ? `docker tag ${imageWithVersion} ${imageWithVersionMajMin}` : `echo "could not tag with major.minor version"`;
const tagLatestCommand = `docker tag ${imageWithVersion} ${imageAsLatest}`;

const pushCommand = `docker push ${imageWithVersion}`;
const pushMajorCommand = imageWithVersionMajor ? `docker push ${imageWithVersionMajor}` : `echo "could not push major version"`;
const pushMajMinCommand = imageWithVersionMajMin ? `docker push ${imageWithVersionMajMin}` : `echo "could not push major.minor version"`;
const pushLatestCommand = `docker push ${imageAsLatest}`;

const cleanCommand = `rm -rf dist`;

const compileTypescript = `tsc -p tsconfig.prod.json`;

const moveFiles = `cp ./{package.json,yarn.lock,.sequelizerc,LICENSE,docker-entry.sh,migrate.sh} dist`;
const moveMigrations = `cp -R sequelize-migrations dist/`;

gulp.task("default", ["docker-build"]);

gulp.task("release", ["docker-push"]);

gulp.task("build", shell.task([
        cleanCommand,
        compileTypescript,
        moveFiles,
        moveMigrations
    ])
);

gulp.task("docker-build",["build"], shell.task([
        buildCommand,
        tagMajorCommand,
        tagMajMinCommand,
        tagLatestCommand
    ])
);

gulp.task("docker-push", ["docker-build"], shell.task([
        pushCommand,
        pushMajorCommand,
        pushMajMinCommand,
        pushLatestCommand
    ])
);

function versionMajorMinor(version: string) {
    const parts = version.split(".");

    if (parts.length === 3) {
        return [`${parts[0]}`, `${parts[0]}.${parts[1]}`];
    }

    return [null, null];
}
