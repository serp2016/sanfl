import { databaseInjector } from '../bootstrap'
import { DatabaseService } from '../services/database.service'
import { League } from './league'
import * as Promise from 'bluebird'

export class Fixture extends (databaseInjector.get(DatabaseService) as DatabaseService).Model<Fixture> {

    constructor(params?: string | any) {
        if (typeof params === 'string') {
            super()
            this.name = params
        } else {
            super(params)
        }
    }

    get tableName() { return 'fixture'; }

    get name(): string { return this.get('name') }
    set name(value: string) { this.set('name', value) }
    set description(value: string) { this.set('description', value) }
    get description(): string { return this.get('description') }
    set startDate(value: Date) { this.set('startDate', value) }
    get startDate(): Date { return this.get('startDate') }
    set endDate(value: Date) { this.set('endDate', value) }
    get endDate(): Date { return this.get('endDate') }
    set createdOn(value: Date) { this.set('createdOn', value) }
    get createdOn(): Date { return this.get('createdOn') }
    set createdBy(value: string) { this.set('createdBy', value) }
    get createdBy(): string { return this.get('createdBy') }
    set generatedOn(value: Date) { this.set('generatedOn', value) }
    get generatedOn(): Date { return this.get('generatedOn') }
    set generatedBy(value: string) { this.set('generatedBy', value) }
    get generatedBy(): string { return this.get('generatedBy') }

    getLeague(): Promise<League> {
        return this.fetch({ withRelated: ['league'] }).then((res) => {
            return res.related('league') as League
        })
    }
    setLeague(value: League) { this.set('league_id', value.id) }

    /**
     * Needed by bookshelf to setup relationship
     */
    protected league() {
        return this.belongsTo(League)
    }
}
