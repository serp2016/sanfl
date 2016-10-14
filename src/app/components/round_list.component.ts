import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core'
import { ActivatedRoute, Router, Params } from '@angular/router';
import { REACTIVE_FORM_DIRECTIVES, FormGroup, FormControl, FormBuilder } from '@angular/forms'
import { Validators } from '@angular/common'
import { FixtureService } from '../services/fixture.service'
import { RoundService } from '../services/round.service'
import { MatchConfigService } from '../services/match_config.service'
import { Collection } from '../services/collection'
import { Fixture } from '../models/fixture'
import { League } from '../models/league'
import { Team } from '../models/team'
import { Round } from '../models/round'
import { MatchConfig } from '../models/match_config'
import { RoundForm } from '../models/round.form'
import { ButtonPopover } from './button_popover.component'
import { ButtonHidden } from './button_hidden.component'
import { DateTime } from '../util/date_time'
import { DaysOfWeek } from '../util/days_of_week'
import { Search } from '../util/search'
import { Validator } from '../util/validator'
import { POPOVER_DIRECTIVES, PopoverContent } from 'ng2-popover';
import { TeamName } from './pipes/team_name'
import { Subscription } from 'rxjs/Subscription'
import * as moment from 'moment'
import * as twitterBootstrap from 'bootstrap'
declare var jQuery: JQueryStatic

@Component({
    moduleId: module.id.replace(/\\/g, '/'),
    providers: [FixtureService, RoundService, MatchConfigService],
    directives: [ButtonPopover, ButtonHidden, REACTIVE_FORM_DIRECTIVES, POPOVER_DIRECTIVES],
    pipes: [TeamName],
    templateUrl: 'round_list.template.html'
})

export class RoundListComponent implements OnInit, OnDestroy {
    constructor(private _changeref: ChangeDetectorRef,
        private _fixtureService: FixtureService,
        private _roundService: RoundService,
        private _matchConfigService: MatchConfigService,
        private _router: Router,
        private _route: ActivatedRoute) {
    }

    @ViewChild('createMatchupButton') createMatchupButton: ButtonPopover
    @ViewChild('deleteMatchupButton') deleteMatchupButton: ButtonPopover
    @ViewChild('createMatchupPopover') createMatchupPopover: PopoverContent
    matchupForm: FormGroup
    error: Error

    ngOnInit() {
        this.matchupForm = new FormGroup({
            round: new FormControl(),
            homeTeam: new FormControl('', [<any>Validators.required]),
            awayTeam: new FormControl('', [<any>Validators.required]),
            config: new FormControl()
        }, {}, Validator.differentTeamsSelected)

        this._router.routerState.parent(this._route)
            .params.forEach(params => {
                let id = +params['id'];
                this._fixtureService.getFixtureAndTeams(id).then((f) => {
                    this.fixture = f
                    return this._fixtureService.getRoundsAndConfig(f)
                }).then((rounds: Collection<Round>) => {
                    this.rounds = rounds.toArray()
                    DateTime.fillInRounds(this.fixture, this.rounds, true)
                    this.homeTeamsAll = this.fixture.leaguePreLoaded.teamsPreLoaded.toArray()
                    this.awayTeamsAll = this.homeTeamsAll.slice(0) //copy
                    let anyTeam = new Team('Any')
                    anyTeam.id = Team.ANY_TEAM_ID
                    this.homeTeamsAll.push(anyTeam)
                    this.byeTeam = new Team('Bye')
                    this.byeTeam.id = Team.BYE_TEAM_ID
                    this.awayTeamsAll.push(this.byeTeam)
                    this.homeTeams = this.homeTeamsAll.slice(0) //copy
                    this.awayTeams = this.homeTeamsAll.slice(0) //copy
                    this._changeref.detectChanges()
                }).catch((err: Error) => {
                    let detail = err ? err.message : ''
                    this.error = new Error(`Error loading rounds: ${detail}`)
                    this._changeref.detectChanges()
                })
            })
    }

    ngOnDestroy() {
        if (this.homeTeamChange) {
            this.homeTeamChange.unsubscribe()
        }
    }

    /**
     * Called after ngFor is complete.
     * 
     * If, in the future, Angular2 provides native support for
     * ngFor-on-complete, update this method. 
     */
    onAfterFor() {
        this.enableTooltipForOverflowedElements('.matchup-button')
    }

    /**
     * Prepares the match-up form based on what the user selected.
     *
     * There is only one match-up form: the form changes based upon what round
     * or match-up the user selects.
     *
     * `round` the selected round.
     * `config` (optional) the selected match-up. If not supplied, a new
     * match-up will be created.
     */
    prepareForm(round: Round, config?: MatchConfig) {
        if (config) {
            this.editing = true
            this.matchupButtonText = RoundListComponent.EDIT_MATCHUP
        } else {
            this.matchupButtonText = RoundListComponent.CREATE_MATCHUP
            this.editing = false
        }
        let fc = this.matchupForm.controls['round'] as FormControl
        fc.updateValue(round)
        fc = this.matchupForm.controls['config'] as FormControl
        fc.updateValue(config)
        if (config && config.homeTeamPreLoaded) {
            fc = this.matchupForm.controls['homeTeam'] as FormControl
            for (let team of this.homeTeamsAll) {
                if (team.id == config.homeTeamPreLoaded.id) {
                    fc.updateValue(team)
                    break
                }
            }
        }
        if (config && config.awayTeamPreLoaded) {
            fc = this.matchupForm.controls['awayTeam'] as FormControl
            for (let team of this.awayTeamsAll) {
                if (team.id == config.awayTeamPreLoaded.id) {
                    fc.updateValue(team)
                    break
                }
            }
        }
        this.removeHomeTeamsAsAlreadyReserved(round,
            config ? config.homeTeamPreLoaded : null,
            config ? config.awayTeamPreLoaded : null)
        this.removeAwayTeamsAsAlreadyReserved(round,
            config ? config.homeTeamPreLoaded : null,
            config ? config.awayTeamPreLoaded : null)
        this._changeref.detectChanges()
        if (!config || !config.homeTeamPreLoaded) {
            let fc = this.matchupForm.controls['homeTeam'] as FormControl
            fc.updateValue(null)
        }
        if (!config || !config.awayTeamPreLoaded) {
            let fc = this.matchupForm.controls['awayTeam'] as FormControl
            fc.updateValue(null)
        }

        if (!this.homeTeamChange) {
            fc = this.matchupForm.controls['homeTeam'] as FormControl
            this.homeTeamChange = fc.valueChanges.subscribe((evt: Team) => {
                if (evt && evt.id == Team.ANY_TEAM_ID) {
                    this.awayTeams = [this.byeTeam]
                    fc = this.matchupForm.controls['awayTeam'] as FormControl
                    fc.updateValue(this.byeTeam)
                } else {
                    this.removeAwayTeamsAsAlreadyReserved(round,
                        config ? config.homeTeamPreLoaded : null,
                        config ? config.awayTeamPreLoaded : null)
                }
            })
        }
    }

    /**
     * create the match-up in the database based on the user's responses to the
     * match-up form. Clears the form.
     */
    createMatchup(form: RoundForm) {
        this._roundService.addRound(form.round).then(() => {
            let config = form.config
            if (!config) {
                config = new MatchConfig()
            }
            config.setRound(form.round)
            config.setHomeTeam(form.homeTeam)
            config.setAwayTeam(form.awayTeam)
            let fc = this.matchupForm.controls['homeTeam'] as FormControl
            fc.updateValue(null)
            fc = this.matchupForm.controls['awayTeam'] as FormControl
            fc.updateValue(null)
            fc = this.matchupForm.controls['config'] as FormControl
            fc.updateValue(null)
            return this._matchConfigService.addMatchConfig(config)
        }).then(() => {
            return this._fixtureService.getRoundsAndConfig(this.fixture)
        }).then((rounds: Collection<Round>) => {
            this.rounds = rounds.toArray()
            DateTime.fillInRounds(this.fixture, this.rounds, true)
            this.createMatchupPopover.hide()
            this._changeref.detectChanges()
        }).catch((err: Error) => {
            this.createMatchupButton.showError('Error creating match-up', err.message)
        })
    }

    deleteMatchup(form: RoundForm) {
        if (form.config) {
            this._matchConfigService.deleteMatchConfig(form.config).then(() => {
                return this._fixtureService.getRoundsAndConfig(this.fixture)
            }).then((rounds: Collection<Round>) => {
                this.rounds = rounds.toArray()
                DateTime.fillInRounds(this.fixture, this.rounds, true)
                this.createMatchupPopover.hide()
                this._changeref.detectChanges()
            }).catch((err: Error) => {
                this.deleteMatchupButton.showError('Error deleting match-up', err.message)
            })
        } else {
            this.deleteMatchupButton.showError('Error deleting match-up', 'The match-up could not be found')
        }
    }

    /**
     * Remove teams from the drop-down home teams list.
     *
     * If the user has reserved a match-up, remove from the list so the user
     * can't reserve the same team again on the same round.
     * 
     * `round` the round containing the match-ups
     * `homeTeam` (optional) Do not remove this home team from the home list,
     *      because the user is editing.
     * `awayTeam` (optional) Do not remove this away team from the away list,
     *      because the user is editing.
     */
    private removeHomeTeamsAsAlreadyReserved(round: Round, homeTeam?: Team, awayTeam?: Team) {
        let configs = round.matchConfigsPreLoaded
        this.homeTeams = this.homeTeamsAll.slice(0) //copy
        // config null if matchConfigsPreLoaded fails. If fails, show all teams
        if (configs) {
            for (let config of configs) {
                let count = 0
                for (let i = this.homeTeams.length - 1; i >= 0; i--) {
                    if ((config.homeTeam_id != Team.ANY_TEAM_ID &&
                        this.homeTeams[i].id == config.homeTeam_id &&
                        // don't delete the homeTeam as requested
                        !(homeTeam && homeTeam.id == this.homeTeams[i].id))
                        ||
                        (this.homeTeams[i].id == config.awayTeam_id &&
                            // don't delete the awayTeam as requested
                            !(awayTeam && awayTeam.id == this.homeTeams[i].id))) {
                        this.homeTeams.splice(i, 1)
                        count++
                        if (count >= 2) {
                            break
                        }
                    }
                }
            }
        }
    }

    /**
     * Remove teams from the drop-down away teams list.
     *
     * If the user has reserved a match-up, remove from the list so the user
     * can't reserve the same team again on the same round.
     * 
     * `round` the round containing the match-ups
     * `homeTeam` (optional) Do not remove this home team from the home list,
     *      because the user is editing.
     * `awayTeam` (optional) Do not remove this away team from the away list,
     *      because the user is editing.
     */
    private removeAwayTeamsAsAlreadyReserved(round: Round, homeTeam?: Team, awayTeam?: Team) {
        let configs = round.matchConfigsPreLoaded
        this.awayTeams = this.awayTeamsAll.slice(0) //copy
        // config null if matchConfigsPreLoaded fails. If fails, show all teams
        if (configs) {
            for (let config of configs) {
                let count = 0
                for (let i = this.awayTeams.length - 1; i >= 0; i--) {
                    // don't delete the bye from the away teams
                    if ((config.awayTeam_id != Team.BYE_TEAM_ID &&
                        this.awayTeams[i].id == config.awayTeam_id &&
                        // don't delete the awayTeam as requested
                        !(awayTeam && awayTeam.id == this.awayTeams[i].id))
                        ||
                        (this.awayTeams[i].id == config.homeTeam_id &&
                            // don't delete the homeTeam as requested
                            !(homeTeam && homeTeam.id == this.awayTeams[i].id))) {
                        this.awayTeams.splice(i, 1)
                        count++
                        if (count >= 2) {
                            break
                        }
                    }
                }
            }
        }
    }
    
    /**
     * Enable a popup tooltip for overflowed elements. For example, if the
     * text is too long for the button, display a tooltip showing the whole
     * text.
     * 
     * `selector` is jQuery selector string to select the elements.
     */
    private enableTooltipForOverflowedElements(selector: string) {
        jQuery(selector).each((index, elem) => {
            let jElem = jQuery(elem)
            if (elem.scrollWidth > jElem.innerWidth()) {
                jElem.tooltip({
                    delay: { 'show': 1000, 'hide': 100 },
                    trigger: 'hover'
                })
            }
        })
    }

    private static CREATE_MATCHUP: string = 'Create Match-up'
    private static EDIT_MATCHUP: string = 'Edit Match-up'
    private matchupButtonText: string
    private initComplete: boolean = false
    private rounds: Round[] = []
    private homeTeams: Team[]
    private homeTeamsAll: Team[]
    private awayTeams: Team[]
    private awayTeamsAll: Team[]
    private byeTeam : Team
    private fixture: Fixture
    private editing: boolean
    private homeTeamChange: Subscription
}
