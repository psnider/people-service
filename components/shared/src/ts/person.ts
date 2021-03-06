import {Person, Name} from '../../../../local-typings/people-service/shared/person'


// return the concatenation of name.given name.family
// Returns null if none of those three are set.
export function getFullName(locale: string, name : Name) : string {
    function getNameComponents(components) {
        return components.filter((component) => {return (component != null);});
    }
    switch (locale) {
    case 'en_US':
    case 'es_US':
    case 'fr_FR':
        return getNameComponents([name.given, name.family]).join(' ');
    case 'ja_JP':
        return getNameComponents([name.family, name.given]).join(' ');
    default:
        throw new Error('localizePersonName doesnt support locale=' + locale);
    }
}


export function convertJSONToObject(person: Person) : void {
    if (person.last_known_loc != null) {
        if (person.last_known_loc.when != null) {
            person.last_known_loc.when = new Date(person.last_known_loc.when.toString())
        }
    }
}
