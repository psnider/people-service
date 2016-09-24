import HTTP_STATUS = require('http-status-codes');
import request = require('request')
import CHAI = require('chai')
const  expect = CHAI.expect

import configure = require('configure-local')
import Database = require('document-database-if')
import PERSON = require('Person')
import Person = PERSON.Person
import test_support         = require('../../src/ts/test-support')


type PersonCallback = (error: Error, results?: Person) => void
type PeopleCallback = (error: Error, results?: Person[]) => void
type PersonOrPeopleCallback = (error: Error, results?: Person | Person[]) => void

const URL = configure.get('people:service-url')
const POST_FEED_TIMEOUT = 1 * 1000


function post(msg: Database.Request<Person>, done: (error: Error, results?: Database.Response<Person>) => void) {
    var options: request.OptionsWithUri = {
        uri: URL,
        timeout: POST_FEED_TIMEOUT,
        method: 'POST',
        json: msg
    }
    request(options, (error, response, body) => {
        // shouldnt be seeing network errors
        if (error) throw error
        if (body.error) {
            error = new Error(body.error.message)
            error.stack = body.error.stack
        }
        if (response.statusCode !== HTTP_STATUS.OK) {
            if (!error) {
                error = new Error(`http statusCode=${response.statusCode}, ${HTTP_STATUS.getStatusText(response.statusCode)}`)
            }
            error.http_status = response.statusCode
        }
        done(error, body)
    })
}


let next_mobile_number = 1234

// This is identical to newPerson() in people-db.tests.ts
function newPerson(options?: {id?: string, name?: Person.Name}) : Person {
    const name = (options && options.name) ? options.name : {given: 'Bob', family: 'Smith'}
    const account_email = `${name.given}.${name.family}@test.co`
    const mobile_number = `555-${("000" + next_mobile_number++).slice(-4)}`
    let person : Person = {
        account_email,
        account_status:    'invitee',
        //role:              'user',
        name,
        locale:            'en_US',
        time_zone:         'America/Los_Angeles',
        contact_methods:   [{method: 'mobile', address: mobile_number}]
    }
    if (options && options.id) person.id = options.id
    return person
}


function postAndCallback(msg: Database.Request<Person>, done: PersonOrPeopleCallback) {
    post(msg, (error, response: Database.Response<Person>) => {
        if (!error) {
            var data = response.data
            // console.log(`postAndCallback msg.action=${msg.action} response.data=${JSON.stringify(data)}`)
        } else {
            // console.log(`postAndCallback error=${error}`)
        }
        done(error, data)
    })
}


function createPerson(person: Person, done: PersonCallback) : void {
    let msg : Database.Request<Person> = {
        action: 'create',
        obj: person
    }
    postAndCallback(msg, done)
}


function readPerson(id: string, done: PersonCallback) : void {
    let msg : Database.Request<Person> = {
        action: 'read',
        obj: {id}
    }
    postAndCallback(msg, done)
}


function replacePerson(person: Person, done: PersonCallback) : void {
    let msg : Database.Request<Person> = {
        action: 'replace',
        obj: person
    }
    postAndCallback(msg, done)
}


function updatePerson(id: Database.DatabaseID, updates: Database.UpdateFieldCommand[], done: Database.UpdateSingleCallback<Person>): void {
// console.log(`id=${id}`)
// console.log(`updates=${JSON.stringify(updates)}`)
    let msg : Database.Request<Person> = {
        action: 'update',
        query: {conditions: {id}},
        updates
    }
    postAndCallback(msg, done)
}


function deletePerson(id: string, done: (error?: Error) => void) : void {
    let msg : Database.Request<Person> = {
        action: 'delete',
        query: {conditions: {id}},
    }
    postAndCallback(msg, done)
}


function findPeople(conditions : Database.Conditions, fields: Database.Fields, sort: Database.Sort, cursor: Database.Cursor, done: PeopleCallback) : void {
    let msg : Database.Request<Person> = {
        action: 'find',
        query: {conditions, fields, sort, cursor}
    }
    postAndCallback(msg, done)
}




// NOTE: these tests are identical to the ones in people-db.tests.ts
// except for checking http status codes
describe('people-service', function() {
    
    describe('create', function() {

        it('should create a new Person', function(done) {
            const PERSON = newPerson()
            createPerson(PERSON, (error, person: Person) => {
                expect(error).to.not.exist
                expect(person).to.not.equal(PERSON)
                expect(person).to.have.property('id')
                expect(person.name).to.deep.equal(PERSON.name)
                done(error)
            })
        })


        it('should not modify the original Person', function(done) {
            const PERSON = newPerson()
            createPerson(PERSON, (error, person: Person) => {
                if (!error) {
                    expect(PERSON).to.not.have.property('id')
                }
                done(error)
            })
        })


        it('should return an error if the Person contains an ID', function(done) {
            const PERSON = newPerson({id: '1'})
            createPerson(PERSON, (error, person: Person) => {
                expect(error.message).to.equal('id isnt allowed for create')
                expect(error['http_status']).to.equal(400)
                expect(person).to.not.exist
                done()
            })
        })

    })


    describe('read', function() {

        function testRead(options: {use_created_id?: boolean, test_id?: string}, done: (error: Error, id?: string, person?: Person) => void) {
            const PERSON = newPerson()
            createPerson(PERSON, (error, created_person: Person) => {
                if (!error) {
                    const id = (options.use_created_id ? created_person.id : options.test_id)
                    readPerson(id, (error, read_person: Person) => {
                        done(error, id, read_person)
                    })
                } else {
                    done(error)
                }
            })
        }


        it('should return a Person when the id is valid', function(done) {
            testRead({use_created_id: true}, (error, id, person) => {
                if (!error) {
                    expect(person).to.have.property('id', id)
                }
                done(error)
            })
        })


        it('should return an error when the request is missing the id', function(done) {
            testRead({test_id: undefined}, (error, id, person) => {
                expect(error.message).to.equal('id is invalid')
                done()
            })
        })


        it('should return an error when the id doesnt reference a Person', function(done) {
            const query_id = 'not-a-likely-id'
            testRead({test_id: query_id}, (error, id, person) => {
                expect(error.message).to.equal('id is invalid')
                done()
            })
        })

    })




    describe('update', function() {

        function testUpdate(options: {use_created_id?: boolean, test_id?: string}, update: Database.UpdateFieldCommand, done: Database.UpdateSingleCallback<Person>) {
            const PERSON = newPerson()
            createPerson(PERSON, (error, created_person) => {
                expect(error).to.not.exist
                const id = (options.use_created_id ? created_person.id : options.test_id)
                updatePerson(id, [update], (error, updated_person) => {
                    done(error, updated_person)
                })
            })
        }


        it('should update a Person when the id is valid', function(done) {
            testUpdate({use_created_id: true},
                {cmd: 'set', field: 'account_email', value: 'bubba.smith@test.co'},
                (error, updated_person) => {
                    expect(updated_person.account_email).to.equal('bubba.smith@test.co')
                    done()
                }
            )
        })


        // same as above test, but id is unset
        it('should return an error when the request is missing the id', function(done) {
            testUpdate({test_id: undefined},
                {cmd: 'set', field: 'account_email', value: 'bubba.smith@test.co'},
                (error, updated_person) => {
                    expect(error.message).to.equal('id is invalid')
                    done()
                }
            )
        })


        it('should return an error when the id doesnt reference a Person', function(done) {
            testUpdate({test_id: 'ffffffffffffffffffffffff'},
                {cmd: 'set', field: 'account_email', value: 'bubba.smith@test.co'},
                (error, updated_person) => {
                    expect(error.message).to.deep.equal('id is invalid')
                    done()
                }
            )
        })


        it('subsequent read should get the update', function(done) {
            const email = 'bubba.smith.10@test.co'
            testUpdate({use_created_id: true},
                {cmd: 'set', field: 'account_email', value: email},
                (error, updated_person) => {
                    readPerson(updated_person.id, (error, read_person) => {
                        if (!error) {
                            expect(read_person.account_email).to.equal(email)
                        }
                        done(error)
                    })
                }
            )
        })

    })


    describe('delete', function() {

        function testDelete(options: {use_created_id?: boolean, test_id?: string}, done: (error: Error, id?: string) => void) {
            const PERSON = newPerson()
            createPerson(PERSON, (error, created_person) => {
                expect(error).to.not.exist
                const id = (options.use_created_id ? created_person.id : options.test_id)
                deletePerson(id, (error) => {
                    done(error, id)
                })
            })
        }


        it('should not return an error when the id is valid', function(done) {
            testDelete({use_created_id: true}, (error, id) => {
                expect(error).to.not.exist
                done()
            })
        })


        it('should not be able to read after delete', function(done) {
            testDelete({use_created_id: true}, (error, id) => {
                expect(error).to.not.exist
                readPerson(id, (error, response) => {
                    expect(response).to.not.exist
                    expect(error.message).to.equal('id is invalid')
                    done()
                })
            })
        })


        it('should return an error when the request is missing the id', function(done) {
            testDelete({test_id: undefined}, (error, id) => {
                expect(error.message).to.equal('id is invalid')
                done()
            })
        })


        it('should return an error when the id doesnt reference a Person', function(done) {
            const query_id = 'not-a-likely-id'
            testDelete({test_id: query_id}, (error, id) => {
                expect(error.message).to.equal('id is invalid')
                done()
            })
        })

    })

    // test find first, as it depends upon the database state
    describe('find', function() {

        const TEST_NAMES = [
            {given: 'Aaron', family: 'Aardvark'},
            {given: 'Betsy', family: 'Badger'},
            {given: 'Clair', family: 'Caiman'},
            {given: 'Donny',  family: 'Dragon'},
            {given: 'Elaine', family: 'Elephant'},
            {given: 'Frank', family: 'Fox'},
            {given: 'Gertrude', family: 'Gibbon'},
            {given: 'Harry', family: 'Hawk'},
            {given: 'Iris', family: 'Iguana'},
            {given: 'Jan', family: 'Jaguar'},
            {given: 'Kim', family: 'Koala'},
            {given: 'Lou', family: 'Leopard'},
            {given: 'Mary', family: 'Mamba'},
        ]


        before((done) => {
            let call_done_after_n = test_support.call_done_after_n_calls(TEST_NAMES.length, done)
            for (let name of TEST_NAMES) {
                createPerson(newPerson({name}), call_done_after_n)
            }
        })


        describe('with sort ascending on name.given', function() {

            describe('cursor', function() {

                it('should return the first item when start_offset = 0', function(done) {
                    findPeople(undefined, undefined, undefined, {start_offset: 0}, (error, list: Person[]) => {
                        expect(error).to.not.exist
                        // cannot know which database item will be first
                        expect(list[0]).to.exist
                        done()
                    })
                })


                it('should default start_offset to 0', function(done) {
                    findPeople(undefined, undefined, undefined, {start_offset: 0}, (error, list: Person[]) => {
                        expect(error).to.not.exist
                        expect(list[0]).to.exist
                        // save the first element returned
                        const first_element = list[0]
                        findPeople(undefined, undefined, undefined, undefined, (error, list: Person[]) => {
                            expect(error).to.not.exist
                            expect(list[0]).to.eql(first_element)
                            done()
                        })
                    })
                })


                it('should return the tenth item when start_offset = 9', function(done) {
                    findPeople(undefined, undefined, undefined, {start_offset: 0, count: 10}, (error, list: Person[]) => {
                        expect(error).to.not.exist
                        expect(list[9]).to.exist
                        // save the element list
                        const saved = list
                        findPeople(undefined, undefined, undefined, {start_offset: 9}, (error, list: Person[]) => {
                            expect(error).to.not.exist
                            expect(list[0]).to.eql(saved[9])
                            done()
                        })
                    })
                })


                it('should return one item if count = 1', function(done) {
                    findPeople(undefined, undefined,undefined, {count: 1}, (error, list: Person[]) => {
                        expect(error).to.not.exist
                        expect(list).to.have.lengthOf(1)
                        done()
                    })
                })


                it('should default count to 10', function(done) {
                    findPeople(undefined, undefined,undefined, undefined, (error, list: Person[]) => {
                        expect(error).to.not.exist
                        expect(list).to.have.lengthOf(10)
                        done()
                    })
                })


                it('should return 11 items if count = 11', function(done) {
                    findPeople(undefined, undefined,undefined, {count: 11}, (error, list: Person[]) => {
                        expect(error).to.not.exist
                        expect(list).to.have.lengthOf(11)
                        done()
                    })
                })

            })

        })

    })
    
})

