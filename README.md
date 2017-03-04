# Mouse Light Acquisition Dashboard 

## Pipeline Worker API Service

The worker API service manages the distribution of tasks for a machine or container.  It provides a [graphql](http://graphql.org) endpoint for querying running and complete tasks as well as starting and canceling tasks.

The service does provide any general user interface.  The graphiql  interface is available for crafting queries by hand

##Installation

### Requirements
* [Node.js](https://nodejs.org) v7.5.0 or higher

### Clean Installation
#### Node.js
Set up a Node.js environemtn as you see fit.  In these instructions we will assume a Linux or MacOS system and use NVM to maintain independence from other node environments you may need or want.

* Follow [the instructions here](https://github.com/creationix/nvm#install-script) to install and prepare NVM.
* From a command prompt with the nvm command available enter ```nvm install 7.5.0```
* Confirm installation with ```node --version```
* Install the TypeScript compiler ```npm install -g typescript```

```
labadmin@ubuntu:~$ nvm install 7.5.0
######################################################################## 100.0%
Computing checksum with sha256sum
Checksums matched!
Now using node v7.5.0 (npm v4.1.2)
labadmin@ubuntu:~$ node --version
v7.5.0
labadmin@ubuntu:~$ 
labadmin@ubuntu:~$ npm install -g typescript
/home/labadmin/.nvm/versions/node/v7.5.0/bin/tsc -> /home/labadmin/.nvm/versions/node/v7.5.0/lib/node_modules/typescript/bin/tsc
/home/labadmin/.nvm/versions/node/v7.5.0/bin/tsserver -> /home/labadmin/.nvm/versions/node/v7.5.0/lib/node_modules/typescript/bin/tsserver
/home/labadmin/.nvm/versions/node/v7.5.0/lib
└── typescript@2.2.1 
```
#### Clone Repository and Perform Initial Build
Choose a top-level location for any pipeline services that will be installed.

* Clone the repository ```git clone https://github.com/TeravoxelTwoPhotonTomography/acq-dashboard-worker-api.git```
* ```cd acq-dashboard-worker-api```
* ```npm install``` (this will take it bit, long output)
* ```tsc``` (no output if successful)h


