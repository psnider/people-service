import child_process = require('child_process')
import fs = require('fs')

import configure = require('@sabbatical/configure-local')
import {MicroServiceConfig} from '@sabbatical/generic-data-server'
import {PeopleServerRunner, Options as PeopleServerOptions} from './people-server-runner'
import {call_done_once} from '../../server/test/ts/test-support'




export interface Options {
    people_server?: PeopleServerOptions
}


export class TestPeopleServiceWithInMemoryDB {

    people_server: PeopleServerRunner
    test_process: child_process.ChildProcess


    // @param options: of the mongo_daemon options, only disable_logging is used
    constructor(private cmd: string, private args: string[], private options?: Options) {
        this.options = options || {}
        if (!this.options.people_server) {
            this.options.people_server = {}
        }
    }


    start(done: (error?: Error) => void) {
        var done_once = call_done_once(done)
        var peopleServerCloseHandler: (code: number) => void = (code) => {
            if (code === 1) {
                console.log('people-server exited normally in response to signal')
            } else {
                done_once(new Error(`people-server exited with code ${code}`))
            }
        }
        this.options.people_server.closeHandler = peopleServerCloseHandler
        this.options.people_server.env = {'people:db:type': 'InMemoryDB'}
        this.people_server = new PeopleServerRunner(this.options.people_server)
        this.people_server.start(() => {
            this.test((code) => {
                if (code === 0) {
                    console.log('test completed successfully')
                } else {
                    console.error(`test failed with code=${code}`)
                }
                console.log('stopping people-server')
                this.people_server.stop(() => {
                    done_once()
                })
            })
        })
    }


    test(closeHandler: (code: number) => void) {
        // default options pass process.env along
        this.test_process = child_process.spawn(this.cmd, this.args)
        this.test_process.stdout.on('data', function (data) {
            console.log(data.toString())
        })
        this.test_process.stderr.on('data', function (data) {
            console.error(data.toString())
        })
        this.test_process.on('close', closeHandler)
    }

}



// test programs should set the configuration of people:api_url and people:db:type

export function run() {
    const config = <MicroServiceConfig>configure.get('people')
    process.env['people:db:type'] = 'InMemoryDB'
    process.env['people:api_port'] = config.api_port
    process.env['people:api_url'] = config.api_url
    process.env['PATH'] = `node_modules/.bin:${process.env['PATH']}`
    configure.reloadConfig()
    var args = ['-R','spec','generated/server/test/people-service.tests.js']
    var options = {
        people_server: {
            disable_console_logging: true,
        }
    }
    var test = new TestPeopleServiceWithInMemoryDB('mocha', args, options)
    test.start((error) => {
        if (!error) {
            process.exit(0)
        } else {
            console.log(`error=${error}`)
            process.exit(1)
        }
    })
}