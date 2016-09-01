import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core'
import { ActivatedRoute, Router, Params } from '@angular/router';
import { FixtureService } from '../services/fixture.service'
import { Fixture } from '../models/fixture'
import { Round } from '../models/round'
import { DaysOfWeek } from '../util/days_of_week'
import * as moment from 'moment'

@Component({
    moduleId: module.id.replace(/\\/g, '/'),
    providers: [FixtureService],
    templateUrl: 'round_list.template.html'
})

export class RoundListComponent implements OnInit {
    constructor(private _changeref: ChangeDetectorRef,
        private _fixtureService: FixtureService,
        private _router: Router,
        private _route: ActivatedRoute) {
    }

    ngOnInit() {
        this._router.routerState.parent(this._route)
            .params.forEach(params => {
                let id = +params['id'];
                this._fixtureService.getFixture(id).then((f) => {
                    this.fixture = f
                    let runningDate = moment(f.startDate)
                    if (runningDate.day() == DaysOfWeek.Sunday) {
                        runningDate.subtract(1, 'day')
                    } else if (runningDate.day() < DaysOfWeek.Saturday) {
                        runningDate.add(DaysOfWeek.Saturday - runningDate.day(), 'day')
                    }
                    for (let i = 1; i <= this.getNumberOfRounds(f.startDate, f.endDate); i++) {
                        if (i == 1) {
                            this.rounds.push(new Round({ number: i, startDate: f.startDate }))
                        } else {
                            runningDate.add(1, 'week')
                            this.rounds.push(new Round({ number: i, startDate: moment(runningDate).toDate() }))
                        }
                    }
                    this._changeref.detectChanges()
                })
            })
    }

    /**
     * Return the number of rounds between two dates.
     * 
     * The `startDate` can be any day of the week. If `startDate` is a weekend,
     * the round count will include that weekend, otherwise count starts at
     * next weekend. 
     * 
     * The `endDate` can be any day of the week. If `endDate` is a weekend, the
     * round count will include that weekend, otherwise count ends at the
     * previous weekend.
     * 
     * If both `startDate` and `endDate` are mid-week in the same week, the
     * returned round count will be 0.

     * If both `startDate` and `endDate` are on the weeked in the same week, the
     * returned round count will be 1.
     */
    private getNumberOfRounds(startDate: Date, endDate: Date): number {
        let start = moment(startDate)
        let end = moment(endDate)
        if (start.day() == DaysOfWeek.Sunday) {
            start.subtract(1, 'day')
        } else if (start.day() < DaysOfWeek.Saturday) {
            start.add(DaysOfWeek.Saturday - start.day(), 'day')
        }
        if (end.day() < DaysOfWeek.Saturday) {
            end.subtract(end.day() + 1, 'day')
        }
        let daysdiff = end.diff(start, 'days')
        if (daysdiff < 0) {
            return 0
        } else if (daysdiff == 0) {
            return 1
        } else {
            return Math.round(daysdiff / 7) + 1
        }
    }

    private rounds: Round[] = []
    private fixture: Fixture
}
