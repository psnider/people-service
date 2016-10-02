import CHAI                 = require('chai')
const  expect               = CHAI.expect

import {ArrayCallback, Conditions, Cursor, DatabaseID, DocumentDatabase, ErrorOnlyCallback, Fields, ObjectCallback, Sort, UpdateFieldCommand} from 'document-database-if'
import {UpdateConfiguration, test_create, test_read, test_replace, test_del, test_update, test_find} from 'document-database-tests'

// select either: people-db-mongo or people-db-in-memory
import {InMemoryDB} from '../../src/ts/people-db-in-memory'
import test_support         = require('../../src/ts/test-support')
import PERSON = require('Person')
type Person = PERSON.Person


var db: DocumentDatabase<Person> = new InMemoryDB('people', 'Person')





let next_email_id = 1
let next_mobile_number = 1234

// This is identical to newPerson() in people-db.tests.ts
function newPerson(options?: {_id?: string, name?: Person.Name}) : Person {
    const name = (options && options.name) ? options.name : {given: 'Bob', family: 'Smith'}
    const account_email = `${name.given}.${name.family}.${next_email_id++}@test.co`
    const mobile_number = `555-${("000" + next_mobile_number++).slice(-4)}`
    let person : Person = {
        account_email,
        account_status:    'invitee',
        //role:              'user',
        name,
        locale:            'en_US',
        contact_methods:   [{method: 'mobile', address: mobile_number}]
    }
    if (options && options._id) person._id = options._id
    return person
}


let next_contact_number = 1
function newContactMethod() : PERSON.ContactMethod {
    const phone_number = `555-${("001" + next_mobile_number++).slice(-4)}`
    return {
        method: ((next_contact_number++ % 2) == 0) ? 'phone' : 'mobile', 
        address: phone_number
    }
}




// NOTE: these tests are identical to the ones in people-service.tests.ts
describe('InMemoryDB', function() {

    function getDB() {return db}

    describe('create()', function() {
         test_create<Person>(getDB, newPerson, ['account_email', 'locale'])        
    })


    describe('read()', function() {
         test_read<Person>(getDB, newPerson, ['account_email', 'locale'])        
    })


    describe('replace()', function() {
         test_replace<Person>(getDB, newPerson, ['account_email', 'locale'])        
    })


    describe('update()', function() {
        var config: UpdateConfiguration = {
            test: {
                populated_string: 'account_email',
                unpopulated_string: 'time_zone',
                obj_array: {
                    name: 'contact_methods',
                    key_field: 'address',
                    populated_field: {name:'method', type: 'string'},
                    createElement: newContactMethod
                }
            },
            unsupported: {
                object: {
                    set: false, 
                    unset: true
                },
                array: {
                    set: true,
                    unset: true,
                    insert: true,
                    remove: true
                }
            }
        }

        test_update<Person>(getDB, newPerson, config)
    })


    describe('del()', function() {
         test_del<Person>(getDB, newPerson, ['account_email', 'locale'])        
    })


    describe('find()', function() {
         test_find<Person>(getDB, newPerson, 'account_email')
    })


})
