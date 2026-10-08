/* nova-fields.js -- what record fields do, as the program does it.
   =========================================================================

   A note here says what the game does with a field, read from Mac 1.1.1's
   Intel code and nothing else: not the Bible, not the editors' templates,
   not the wiki. Each names the routines it was read from, by the names the
   program carries and their addresses, so it can be read again; a field
   with no note has not been traced. evnova-workbench's tools/fieldtrace.py
   finds where a loader puts each field and which routines use that place;
   utilities/fields_check.mjs holds every routine named here to the
   program's own symbols.

   The plug-in editor shows a note beside its field (page-plugin.js).

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-records.js. */

const NOVA_FIELD_NOTES = {
  'sÿst': {
    AvgShips: {
      note: 'How many ships are placed when you enter the system: each is a përs 1 time in 7 (one picked from those that may be met here), else a flët 1 time in 7, else a ship from DudeTypes.',
      code: [['SetupShipsInSystem', 0x42b61], ['SpawnPerson', 0x408d5], ['SpawnFleet', 0x42704], ['RandomShipSpawn', 0x3c0f3], ['Rand', 0xa4c76]],
    },
    Person: {
      note: 'Up to eight përs that may be here as well as those AvgShips brings: each, while not destroyed or captured and its ActivateOn holds, comes when you enter with a chance of its PersonProb in 100.',
      code: [['SetupShipsInSystem', 0x42b61], ['SpawnPerson', 0x408d5], ['EvalMissionBitTestString', 0x9959e]],
    },
    PersonProb: {
      note: 'The chance in 100 that the Person beside it comes when you enter.',
      code: [['SetupShipsInSystem', 0x42b61], ['Rand', 0xa4c76]],
    },
    Message: {
      note: 'Shown when you arrive: entry Message of STR# 1000, or the STR resource numbered Message + 999 where there is one. -1: "Entering the", "Jumping into the" or "Arriving in the", at random, and the system\'s name.',
      code: [['HandlePlayer', 0x68390], ['DisplayMessage', 0x5289], ['LoadPluginString', 0x71a8e]],
    },
    ReinfFleet: {
      note: 'The flët that comes when a ship of a government allied with the fleet\'s calls for help in this system: when the odds against it are more than half the MaxOdds of the fleet\'s government, or, without that test, when a ship you hail comes to help you. While it is on its way, a warship of that side holds out to twice its MaxOdds before it runs, not once. Below 128: none.',
      code: [['AICallForReinforcements', 0x7f5a1], ['GovtAllies', 0x4e3d], ['WarshipAI', 0x8b729], ['DoCommDialog', 0x956d5], ['LoadObjectData', 0x771b0], ['HandleReinforcements', 0x39048]],
    },
    ReinfTime: {
      note: 'How long the fleet takes to come once called: counted down by the game speed each step, then it arrives from hyperspace. When less than a quarter is left: "Sensors detect" the government\'s name "reinforcement fleet approaching."',
      code: [['AICallForReinforcements', 0x7f5a1], ['HandleReinforcements', 0x39048]],
    },
    ReinfIntrval: {
      note: 'Days before the fleet can be called here again, from its warning or its arrival; at least 1.',
      code: [['HandleReinforcements', 0x39048], ['IncrementGameTime', 0xb516]],
    },
  },
  'shïp': {
    TechLevel: {
      note: 'Offered in a stellar\'s shipyard whose TechLevel is at least this, or one of whose SpecialTech is this. Below 0: in none.',
      code: [['SetupPortAvailableShipTypes', 0xbbe3]],
    },
    Cost: {
      note: 'What the shipyard asks is this less a trade-in, never below 0: a quarter of your own ship\'s Cost and half the Cost of each outfit you carry, some outfits aside. Each is multiplied by the PriceMod of every rank you hold with a government allied to the stellar\'s, the trade-in twice over; at a stellar of TechLevel 5 or less, a ship of lower TechLevel costs 3% less for each level between (from 100 credits), the trade-in again twice; and each is rounded down to 10 credits above 100, 100 above 10,000, 1,000 above 100,000.',
      code: [['CalcShipCanBuy', 0x4f5eb], ['PlayerShipTradeInPrice', 0xb079], ['ApplyPriceAndTechnologyFlux', 0x4e6cd], ['DoPortDialog', 0x5f911]],
    },
    BuyRandom: {
      note: 'The chance in 100 it is offered on a given day: it is offered while BuyRandom is at least a number from 1 to 100 drawn for its class each day. 0: never.',
      code: [['SetupPortAvailableShipTypes', 0xbbe3], ['IncrementGameTime', 0xb516], ['Rand', 0xa4c76]],
    },
    HireRandom: {
      note: 'The chance in 100 it is offered for hire on a given day: it is offered while HireRandom is at least a number from 1 to 100 drawn for its class each day. 0: never. In an unregistered copy, the state in which the program sends its nag ship, Captain Hector, the draw is passed by and every class above 0 is offered every day.',
      code: [['SetupPortAvailableShipTypes', 0xbbe3], ['IncrementGameTime', 0xb516], ['SpawnNagShip', 0x5fdb]],
    },
    Require: {
      note: 'Offered only when the Contributes bits of your ship and outfits include every bit set here.',
      code: [['SetupPortAvailableShipTypes', 0xbbe3], ['GetPlayerContributeBits', 0x76b2]],
    },
    UpgradeTo: {
      note: 'The ship class an escort of this class that you own (not a hired one) becomes when you have marked it in the escort dialog ("Will be upgraded at next shipyard") and land at a shipyard with its EscUpgrdCost in hand. Below 128: it cannot be ("This ship class cannot be upgraded.").',
      code: [['DoEscortDialog', 0x951ee], ['DoEscortLand', 0x4031f], ['LoadObjectData', 0x771b0]],
    },
    EscUpgrdCost: {
      note: 'Credits taken for that upgrade, at the shipyard; with fewer, it waits.',
      code: [['DoEscortLand', 0x4031f], ['EscortDialogUpdate', 0x94a1b]],
    },
    EscSellValue: {
      note: 'Credits paid to you when you land at a shipyard for an escort of this class marked "Will be sold off at next shipyard", and it leaves. Only escorts you own, not hired ones, and not while disabled. 0 or less: a tenth of its Cost.',
      code: [['DoEscortDialog', 0x951ee], ['DoEscortLand', 0x4031f], ['EscortDialogUpdate', 0x94a1b]],
    },
    DefaultItems: {
      note: 'An outfit a ship of this class comes with, ItemCount of it: 128 to 639 is that oütf; anything else, none. Added to yours when you buy one at a shipyard, start a new pilot in one, capture one, or a set expression gives you one. DefaultItms2 is four more of the same.',
      code: [['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679], ['DoNewPilot', 0x18b0a], ['DoShipCapture', 0x41120], ['EvalSetExp', 0x150fc]],
    },
    ItemCount: {
      note: 'How many of the DefaultItems beside it. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679]],
    },
    DefaultItms2: {
      note: 'Four more DefaultItems, read the same way, with ItemCount2.',
      code: [['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679]],
    },
    ItemCount2: {
      note: 'How many of the DefaultItms2 beside it. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679]],
    },
    Contributes: {
      note: 'Added to your bits while you fly this class. Your bits are those of your ship class, of every outfit you carry, of every ränk you hold and of every crön event that is running; the Require of a shïp, mïsn, crön or gövt, and an oütf\'s Requires, is met when they include every bit it sets.',
      code: [['GetPlayerContributeBits', 0x76b2], ['PlayerMeetsRequirements', 0x776f]],
    },
    FuelRegen: {
      note: 'One unit of Fuel back every FuelRegen steps, times the game speed, up to what it can hold. 0 or less: none. Your own ship regains it only with Flags 0x0008.',
      code: [['ShipFuelGenRate', 0x2ffb], ['HandleShip', 0x33581]],
    },
    Flags3: {
      note: '0x0020: a planet\'s Gravity does not pull it.',
      code: [['ShipResistsGravity', 0x7b10]],
    },
  },
  'gövt': {
    InitialRec: {
      note: 'Your record in each system whose Govt is this, when you start a new pilot; a system with no government starts at 0. When your escape pod is picked up (dësc 13999), every system\'s record goes back to this again.',
      code: [['ResetPlayer', 0x1d40d], ['ResetPlayerRecord', 0x1db70], ['DoNewPilot', 0x18b0a], ['HandlePlayer', 0x68390]],
    },
    ScanFine: {
      note: 'The fine when one of its ships fines you after a scan: 1 and up, that many credits; 0, a warning only; below 0, that percentage of your credits, rounded down to the hundred (at least 1).',
      code: [['ScanPlayer', 0x7e46e]],
    },
    MaxOdds: {
      note: 'Kept as MaxOdds ÷ 100, at least 0.01. A warship of this government runs once the odds against it pass that, or twice that while a reinforcement fleet is on its way; a system\'s reinforcement fleet of this government is called at half of it.',
      code: [['LoadObjectData', 0x771b0], ['WarshipAI', 0x8b729], ['AICallForReinforcements', 0x7f5a1]],
    },
  },
  'mïsn': {
    AvailStel: {
      note: 'Where it is offered. -1: anywhere. 128 to 4999: at that spöb. 5000 + n: in a system with a link to sÿst 128 + n. At a stellar whose government is: 9999, none; 10000 + n, gövt 128 + n; 15000 + n, an ally of it; 20000 + n, any but it, or none; 25000 + n, an enemy of it; 30000 + n, it, or one with the same class in the same one of the four Classes; 31000 + n, neither (not none). Anything else: never. Not tested when a ship offers it. Unless it names one spöb, it is not offered while its TravelStel or ReturnStel is a stellar in the system you are in.',
      code: [['IsMissionAvailable', 0x9b152], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22], ['GovtSharedClass', 0x6e48], ['LoadObjectData', 0x771b0]],
    },
    AvailLoc: {
      note: 'Where it is offered. 0: listed in the Mission BBS. 1: in the bar. 2: by a ship whose përs has it as LinkMission, when you hail the ship, or, with that përs\'s Flags 0x0200, when you board it. 3: on landing, at the spaceport. 4: at the Trade Center. 5: at the shipyard. 6: at the outfitter. Anything else: nowhere.',
      code: [['IsMissionAvailable', 0x9b152], ['OfferMissionFromPort', 0xa369e], ['DoMissionDialog', 0xa37cf], ['DoBarDialog', 0x48ef5], ['DoPortDialog', 0x5f911], ['DoTradeDialog', 0x5dbe1], ['DoShipyardDialog', 0x5e679], ['DoOutfitDialog', 0x5bacf], ['HandlePlayerCommunication', 0x61f48], ['HandlePlayerBoardAttempt', 0x65000]],
    },
    AvailRecord: {
      note: '0: no test. Above 0: your record in this system must be at least this; below 0, at most this. -32000: the stellar you are at must be one you have dominated; -32001: you must have dominated some stellar; below that: never offered.',
      code: [['IsMissionAvailable', 0x9b152]],
    },
    AvailRating: {
      note: '0 or less: no test. Above 0: your combat rating must be at least this.',
      code: [['IsMissionAvailable', 0x9b152]],
    },
    AvailRandom: {
      note: 'The chance in 100 it is offered: each mission has a number from 1 to 100, drawn again from time to time as you play, and it is offered while AvailRandom is at least that. 100 or more: always. 0 or less: never. Accepting it sets its number to 0.',
      code: [['IsMissionAvailable', 0x9b152], ['InitObjects', 0x1c2e5], ['HandlePlayer', 0x68390], ['DoMissionAccept', 0xa1b11]],
    },
    AvailShipTyp: {
      note: '128 to 896: you must be flying that ship class; 1128 to 1896: you must not be. 2128 to 2384: your ship class\'s InherentGovt must name that government (as 128 and up or 1128 and up); 3128 to 3384: it must not. Anything else: no test.',
      code: [['IsMissionAvailable', 0x9b152], ['LoadObjectData', 0x771b0]],
    },
    TravelStel: {
      note: 'Where you must go, picked when the mission is made ready to offer. -1: nowhere. 128 to 2175: that spöb. -2: one picked at random from the stellars that qualify and have Flags 0x20 clear; -3: from those with Flags 0x20 set and 0x10 clear. 9999, 10000 + n, 15000 + n, 20000 + n, 25000 + n, 30000 + n and 31000 + n: from those, Flags 0x20 clear, of the governments AvailStel\'s same numbers name; for 10000 + n, Flags 0x20 set too when gövt 128 + n has Flags 0x0800. A stellar qualifies when its system is there now (its Visibility), it is in every version of that system, you can land on it and it is no hypergate or wormhole (Flags2 0x1000, 0x2000), and it is not where you are nor in your system or one linked to it. The mission is not offered while none qualifies, that last test aside. -4, anything else, or none qualifying: the stellar you are at (offered by a ship, the first in your system). Landing on it, or on a stellar of the same name at the same place, does this part of the mission.',
      code: [['RandomizeOneMission', 0xa14d1], ['SelectMissionStellar', 0x9a26a], ['StellarsAreDistant', 0x9cb9], ['StellarIsNormalLandable', 0xa9f8], ['StellarIsLandable', 0xa989], ['IsMissionAvailable', 0x9b152], ['HandleStellarSystemVisibility', 0x32aa5], ['PropagateMissionBitEffects', 0x99676], ['StellarsAreIdentical', 0xab35], ['MissionLandCargoCheck', 0x9edc5]],
    },
    ReturnStel: {
      note: 'Where you must land for the mission to be done, once the rest of it is: picked as TravelStel is, from where you are, and a random pick never the stellar TravelStel picked. -1: the stellar TravelStel picked, so it is done on landing there; with TravelStel -1 too, no landing does it. Landing on a stellar of the same name at the same place does as well.',
      code: [['RandomizeOneMission', 0xa14d1], ['SelectMissionStellar', 0x9a26a], ['LoadCurrentMissionData', 0xa0a38], ['MissionLandCheck', 0xa19cc], ['StellarsAreIdentical', 0xab35]],
    },
    PickupMode: {
      note: 'When the cargo comes aboard. 0: when you accept, which is refused while the cargo is more than your holds or your free room. 1: on landing at TravelStel\'s stellar; while it will not fit, that stellar does not count as reached. 2: on boarding one of the mission\'s ships. Anything else: never. LoadCargText, if not -1, is shown as it comes aboard by landing or accepting.',
      code: [['DoMissionAccept', 0xa1b11], ['MissionLandCargoCheck', 0x9edc5], ['DoMissionCargoPickup', 0x98292], ['HandlePlayerBoardAttempt', 0x65000]],
    },
    DropoffMode: {
      note: 'Where the cargo comes off, if it is aboard. 0: on landing at TravelStel\'s stellar. 1: on landing at ReturnStel\'s, once its ShipGoal is met or is -1 (with ShipGoal 3, also while a count the mission keeps, not yet read, is 0). Anything else: never. DropCargText, if not -1, is shown then.',
      code: [['MissionLandCargoCheck', 0x9edc5]],
    },
    PayVal: {
      note: 'Above 0: credits paid when the mission is done. -10000 - n: instead, in every system whose government is gövt n, a record below 0 goes to 0; -20000 - n: the same where the government is allied with gövt n; -30000 - n: where it shares a class with it. -40000 - p, p from 1 to 99: you lose p per cent of your credits. -50000 - c, below -50000: it costs c credits, taken when you accept (never leaving you below 0), and it is offered only while you have c. Paid as well when the mission ends by itself, with Flags2 0x0002. Anything else: nothing.',
      code: [['ApplyMissionPay', 0x98326], ['DoMissionSuccess', 0xa03fc], ['AutoAbortMission', 0x99bdc], ['DoMissionAccept', 0xa1b11], ['IsMissionAvailable', 0x9b152], ['GovtAllies', 0x4e3d], ['GovtSharedClass', 0x6e48]],
    },
    ShipSyst: {
      note: 'Where the mission\'s ships are, worked out when you accept. -1: the system you are in then. -2: a random system there now (its Visibility) other than yours. -3: TravelStel\'s stellar\'s system, or ReturnStel\'s if TravelStel has none. -4: ReturnStel\'s. -5: a random system linked to yours and there now, drawn until one is found. -6: whichever system you are in. 128 to 2175: that sÿst. 9999, 10000 + n and the other numbers AvailStel takes for governments: a random system there now, not yours, of those governments. Anything else: nowhere.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['SelectMissionSystem', 0x9b993], ['SetupShipsInSystem', 0x42b61], ['MissionHandlePlayerEnteredNewSystem', 0x99f11]],
    },
    ShipGoal: {
      note: 'What you must do with the mission\'s ships before landing at ReturnStel\'s stellar finishes it. 0: destroy them all. 1: disable them all. 2 and 5: board them all (with 5 they start still and disabled, and stay disabled until boarded). 3: keep them; it is met while one of them is about. 4: see one of them, once all have come (if it can cloak, on your screen). 6: be rid of them, each destroyed or jumped out counting (jumping out does not count with ShipSyst -6). The mission fails at once, unless its Flags has 0x0400, when one is destroyed with goal 1 or 3, or with 2 or 5 before you have boarded it, and when one is disabled with goal 3.',
      code: [['MissionObjectivesCheck', 0x9e79e], ['HandleShipDisplay', 0x2b514], ['DamageShip', 0x3a807], ['HandlePlayerBoardAttempt', 0x65000], ['LowLevelAIHandler', 0x851da], ['QuickMissionFailure', 0x99d1b], ['ShipVisibleToShip', 0x971c], ['SetupShipsInSystem', 0x42b61], ['IsDisabled', 0x2ce6]],
    },
    ShipBehav: {
      note: 'How the mission\'s ships act. 0: each is set on you as it appears. 1: they fly with you as escorts do, while not disabled. 2: they go for stellars, not yet destroyed, of governments their own is an enemy of. Anything else: as their own AI has it.',
      code: [['MissionDudeSpawn', 0x3cd3b], ['AIMakeShipAttackPlayer', 0x89c3e], ['AIDispatch', 0x8fb52], ['DeathStarAI', 0x8c125], ['EscortAI', 0x838d2], ['IsDisabled', 0x2ce6]],
    },
    ShipCount: {
      note: 'How many ships the mission has, placed as ShipSyst and ShipStart say. 0 or less: none. With ShipSyst -6 and ShipBehav 1, those of them already with you are not placed again.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['SetupShipsInSystem', 0x42b61], ['MissionObjectivesCheck', 0x9e79e]],
    },
    ShipDude: {
      note: 'The düde the mission\'s ships are drawn from, each ship\'s class drawn from it in turn; with the mission\'s Flags 0x0800, one class is drawn when you accept and serves for them all.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['MissionDudeSpawn', 0x3cd3b], ['SelectShipFieldFromDude', 0x65c2]],
    },
    CompGovt: {
      note: 'The government whose regard CompReward changes: 128 to 383. Anything else: none, and CompReward is not used.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionSuccess', 0xa03fc]],
    },
    CompReward: {
      note: 'When the mission is done, your record goes up by this in every system whose government is CompGovt, by half of it where the government is an ally of CompGovt\'s, and down by half where it is an enemy. When it fails, down by half in CompGovt\'s systems. When you abort it and its Flags has 0x0040, down by five times this there.',
      code: [['DoMissionSuccess', 0xa03fc], ['DoMissionFailure', 0xa0285], ['DoMissionInfoDialog', 0x9e19b], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22]],
    },
    DatePostInc: {
      note: 'Days that pass when the mission is done, or when it ends by itself.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionSuccess', 0xa03fc], ['AutoAbortMission', 0x99bdc], ['IncrementGameTime', 0xb516]],
    },
    TimeLimit: {
      note: 'Days you have: one comes off each day, and when none are left the mission fails, as soon as you are not in a spaceport, with a message unless its Flags has 0x0400. 0 or less: no limit.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['IncrementGameTime', 0xb516], ['MissionObjectivesCheck', 0x9e79e], ['QuickMissionFailure', 0x99d1b]],
    },
    CanAbort: {
      note: 'Anything but 0: you can abort it from the mission list, and jettison its cargo, which fails it; when it fails, it is taken off your list at once. 0: neither, and a failed mission stays until you next land, when it ends as failed.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionInfoDialog', 0x9e19b], ['PlayerHasJettisonableCargo', 0x825a], ['JettisonCargo', 0x3dffd], ['QuickMissionFailure', 0x99d1b], ['MissionLandCheck', 0xa19cc]],
    },
    BriefText: {
      note: 'The dësc shown when you accept the mission. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionAccept', 0xa1b11]],
    },
    QuickBrief: {
      note: 'The dësc shown for the mission in your list of missions. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionInfoDialog', 0x9e19b], ['MissionInfoFilter', 0x9d6e5]],
    },
    LoadCargText: {
      note: 'The dësc shown when the cargo comes aboard, on accepting or landing (PickupMode 0 or 1). 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionAccept', 0xa1b11], ['MissionLandCargoCheck', 0x9edc5]],
    },
    DropCargText: {
      note: 'The dësc shown when the cargo comes off (DropoffMode). 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['MissionLandCargoCheck', 0x9edc5]],
    },
    CompText: {
      note: 'The dësc shown when the mission is done. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionSuccess', 0xa03fc]],
    },
    FailText: {
      note: 'The dësc shown when the mission fails. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionFailure', 0xa0285]],
    },
    RefuseText: {
      note: 'The dësc shown when you refuse the mission as it is offered. -1: none.',
      code: [['OfferOneMission', 0xa21ac]],
    },
    ShipDoneText: {
      note: 'The dësc shown when the mission\'s ShipGoal is first met. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['MissionObjectivesCheck', 0x9e79e]],
    },
    ShipNameID: {
      note: '-1: the mission\'s ships have their usual names. Otherwise an STR#: one of its strings, picked at random when you accept, is the name of every one of them.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DrawStatusTarg', 0x4ace1], ['AICallForHelp', 0x82ffb]],
    },
    ShipSubtitle: {
      note: '-1: none. Otherwise an STR#: one of its strings, picked at random when you accept, is the subtitle of every one of the mission\'s ships.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DrawStatusTarg', 0x4ace1]],
    },
    ShipStart: {
      note: 'Where the mission\'s ships start. -1 to -16: on the stellar in that place of their system\'s list (-1 the first), there when you arrive. 0, or a place the list does not fill: brought in as the system\'s other ships are, there when you arrive. 1: they come in from hyperspace, making for you, 100 to 199 steps after you arrive (30 with ShipBehav 1 and ShipGoal 3), and so again each time you enter their system. 2: the first time, the same; after that they are there when you arrive, cloaked.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['SetupShipsInSystem', 0x42b61], ['EnterMoreShips', 0x43459], ['MissionHandlePlayerEnteredNewSystem', 0x99f11], ['DoShipCloak', 0xde73], ['GenericRandomShipSpawn', 0x3c89f]],
    },
    AuxShipCount: {
      note: 'How many ships of AuxShipDude the mission sends after you, in the systems AuxShipSyst allows: 70 to 139 steps after you enter such a system (or take off), as many as are left come in from hyperspace, less those already there. Each that comes counts against what is left, unless the mission\'s Flags has 0x0010, when the number is whole again in each system. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['EnterMoreShips', 0x43459], ['MissionHandlePlayerEnteredNewSystem', 0x99f11], ['SpecificDudeSpawn', 0x3d0eb]],
    },
    AuxShipDude: {
      note: 'The düde the aux ships are drawn from: 128 to 639. Anything else: none, and AuxShipCount is not used.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['EnterMoreShips', 0x43459], ['SpecificDudeSpawn', 0x3d0eb]],
    },
    AuxShipSyst: {
      note: 'Where the aux ships come. -1 or -6: any system. -2: TravelStel\'s stellar\'s system; -3: ReturnStel\'s. 128 to 2175: that sÿst. 5000 + n: sÿst 128 + n or a system linked to it. 9999, 10000 + n and the other numbers AvailStel takes for governments: systems of those governments, counting as an enemy of a government with Flags 0x0001 any not its ally. Anything else: none.',
      code: [['ValidAuxShipSystem', 0x992b5], ['EnterMoreShips', 0x43459], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22], ['GovtSharedClass', 0x6e48]],
    },
    ScanMask: {
      note: 'When a ship of a government whose ScanMask shares a bit with this scans you while the mission\'s cargo is aboard: with Flags 0x0020 the mission fails ("Your ship has been scanned - mission failed."); otherwise it is smuggling, and you are fined.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['ScanPlayer', 0x7e46e]],
    },
    Flags: {
      note: '0x0001: it ends by itself once its ships are placed or its ShipGoal is met, or on accepting if it has no ships and no ReturnStel. 0x0002: its systems are not marked on the map. 0x0004: it cannot be refused. 0x0008: offered only while you have 100 units of fuel, which are taken when it ends by itself. 0x0010: the aux ships never run out. 0x0020: it fails if you are scanned with its cargo aboard (ScanMask). 0x0040: aborting it costs five times CompReward. 0x0100: its destination is marked on the map while it is offered. 0x0200: ShipSyst\'s system is marked on the map too. 0x0400: it is left out of your list of missions, its failures show no message, and its ships being destroyed or disabled does not fail it. 0x0800: one class for all its ships (ShipDude). 0x2000: not offered while your ship class\'s InherentAI is 2 or less; 0x4000: while it is 3 or more.',
      code: [['AutoAbortMission', 0x99bdc], ['SetupShipsInSystem', 0x42b61], ['EnterMoreShips', 0x43459], ['MissionObjectivesCheck', 0x9e79e], ['DoMissionAccept', 0xa1b11], ['RecalcMissionSystsForMap', 0xe1b5], ['OfferOneMission', 0xa21ac], ['IsMissionAvailable', 0x9b152], ['ScanPlayer', 0x7e46e], ['DoMissionInfoDialog', 0x9e19b], ['SetupMissionInfoList', 0x9de7a], ['DamageShip', 0x3a807], ['HandleShipDisplay', 0x2b514], ['JettisonCargo', 0x3dffd], ['MissionDudeSpawn', 0x3cd3b]],
    },
    Flags2: {
      note: '0x0001: offered only while your ship has room for its cargo. 0x0002: PayVal is paid when it ends by itself too. 0x0004: it fails if your ship is disabled.',
      code: [['IsMissionAvailable', 0x9b152], ['TotalMissionCargoSpace', 0xcffb], ['AutoAbortMission', 0x99bdc], ['ApplyMissionPay', 0x98326], ['DamageShip', 0x3a807]],
    },
    AvailBits: {
      note: 'A test of control bits: the mission is offered only while it holds. Empty: no test.',
      code: [['InitMissions', 0x97b97], ['IsMissionAvailable', 0x9b152], ['EvalMissionBitTestString', 0x9959e]],
    },
    OnAccept: {
      note: 'Control bits set when you accept the mission.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionAccept', 0xa1b11], ['EvalCurrentMissionBitSetString', 0x99a43]],
    },
    OnRefuse: {
      note: 'Control bits set when you refuse the mission as it is offered.',
      code: [['OfferOneMission', 0xa21ac], ['EvalMissionBitSetString', 0x99dc5]],
    },
    OnSuccess: {
      note: 'Control bits set when the mission is done.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionSuccess', 0xa03fc], ['EvalCurrentMissionBitSetString', 0x99a43]],
    },
    OnFailure: {
      note: 'Control bits set when the mission fails.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionFailure', 0xa0285], ['QuickMissionFailure', 0x99d1b], ['EvalCurrentMissionBitSetString', 0x99a43]],
    },
    OnAbort: {
      note: 'Control bits set when you abort the mission, when a set expression aborts it, when your escape pod is picked up (every mission is aborted then), or when it ends by itself; not when a failed mission is taken off your list.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['AbortMission', 0x99a92], ['DoMissionInfoDialog', 0x9e19b], ['EvalSetExp', 0x150fc], ['HandlePlayer', 0x68390], ['AutoAbortMission', 0x99bdc], ['QuickMissionFailure', 0x99d1b]],
    },
    OnShipDone: {
      note: 'Control bits set when the mission\'s ShipGoal is first met (not with ShipGoal -1).',
      code: [['LoadCurrentMissionData', 0xa0a38], ['MissionObjectivesCheck', 0x9e79e], ['EvalCurrentMissionBitSetString', 0x99a43]],
    },
    AcceptButton: {
      note: 'The label of the Accept button as the mission is offered. Empty, or not starting with a letter: "Yes" if it can be refused, else "Okay" (STR# 150).',
      code: [['OfferOneMission', 0xa21ac]],
    },
    RefuseButton: {
      note: 'The label of the Refuse button as the mission is offered. Empty, or not starting with a letter: "No" (STR# 150).',
      code: [['OfferOneMission', 0xa21ac]],
    },
    DispWeight: {
      note: 'A port\'s missions are put in order of this, highest first: the order of the Mission BBS\'s list, and which is offered first elsewhere.',
      code: [['InitMissions', 0x97b97], ['RandomizeMissionData', 0xa1756], ['OfferMissionFromPort', 0xa369e]],
    },
    CargoType: {
      note: '0 to 999: that cargo. 1000: one of the first six, at random. Anything else: none.',
      code: [['SelectMissionCargoType', 0x981d8]],
    },
    CargoQty: {
      note: '0 and up: that many tons. -1: none. -2 and below: half its size, plus a number from 0 to one less than its size drawn at random, so from half to one and a half times it.',
      code: [['SelectMissionCargoQty', 0x98191]],
    },
  },
  'oütf': {
    TechLevel: {
      note: 'Offered at an outfitter whose stellar\'s TechLevel is at least this, or one of whose SpecialTech is this. Below 0, or 32767: nowhere by its TechLevel.',
      code: [['SetupPortAvailableItems', 0xbedb]],
    },
    BuyRandom: {
      note: 'The chance in 100 it is offered on a given day: it is offered while BuyRandom is at least a number from 1 to 100 drawn for it each day. Above 100: 100. 0 or less: never, unless you already have one.',
      code: [['LoadObjectData', 0x771b0], ['SetupPortAvailableItems', 0xbedb], ['IncrementGameTime', 0xb516]],
    },
    Contributes: {
      note: 'Added to your bits while you carry at least one. Your bits are those of your ship class, of every outfit you carry, of every ränk you hold and of every crön event that is running; the Require of a shïp, mïsn, crön or gövt, and an oütf\'s Requires, is met when they include every bit it sets.',
      code: [['GetPlayerContributeBits', 0x76b2], ['PlayerMeetsRequirements', 0x776f], ['SetupPortAvailableItems', 0xbedb], ['CanBuyOutfitItem', 0x4e7c4]],
    },
  },
  'wëap': {
    Reload: {
      note: 'Steps before it fires again, shared among however many of it the ship carries: Reload ÷ that many for each shot fired, or the whole Reload with Flags 0x0040. At the end of a burst, BurstReload instead.',
      code: [['FireAIShipWeapon', 0x8873d], ['FirePlayerWeapon', 0x62702]],
    },
    Count: {
      note: 'Steps a shot lasts. A shot reaches Count × Speed ÷ 100, and on through its submunitions.',
      code: [['LoadObjectData', 0x771b0], ['HandleShot', 0x35586]],
    },
    Speed: {
      note: 'A shot moves Speed ÷ 100 units a step along its heading; with Count, its reach.',
      code: [['LoadObjectData', 0x771b0], ['HandleShotGuidance', 0x320dc]],
    },
    GuidedTurn: {
      note: 'A homing shot turns a tenth of this in degrees each step, from 15 steps old.',
      code: [['LoadObjectData', 0x771b0], ['HandleShotGuidance', 0x320dc]],
    },
    Impact: {
      note: 'Pushes the ship it hits, unless that ship is jumping.',
      code: [['DamageShip', 0x3a807]],
    },
    Ionization: {
      note: 'Added to the ship it hits; from a blast, less by the square of the distance over the square of BlastRadius, and none beyond it.',
      code: [['IonizeShip', 0x8409]],
    },
    SubCount: {
      note: 'How many shots of SubType a shot breaks into.',
      code: [['SpawnShotSubmunitions', 0x3f1d5]],
    },
    SubTheta: {
      note: 'Above 0: each submunition within this many degrees of the shot\'s heading, at random. Below 0: fanned out this far apart.',
      code: [['SpawnShotSubmunitions', 0x3f1d5]],
    },
    SubLimit: {
      note: 'How many generations of submunitions there can be. Below 1: no limit.',
      code: [['SpawnShotSubmunitions', 0x3f1d5]],
    },
  },
  'përs': {
    Coward: {
      note: 'As a warship of a government with Flags 0x0010 and with no leader, it turns tail once its shields fall below Coward per cent of their full; ships that are not persons go by their aggression instead.',
      code: [['WarshipAI', 0x8b729], ['ShipShieldCapacity', 0x2995]],
    },
    HailPict: {
      note: 'The picture shown when you hail its ship: 128 and up, that PICT; anything else, its ship class\'s.',
      code: [['LoadObjectData', 0x771b0], ['DoCommDialog', 0x956d5]],
    },
    CommQuote: {
      note: 'What its ship answers when you hail it: above 0, the STR resource numbered CommQuote + 15000 where there is one, else entry CommQuote of STR# 7100. -1 with Flags 0x8000: news of a disaster now under way. Otherwise the usual answer.',
      code: [['LoadAdvice', 0x9133c], ['LoadPluginString', 0x71a8e]],
    },
    Subtitle: {
      note: 'Shown for its ship in your target display.',
      code: [['LoadObjectData', 0x771b0], ['DrawStatusTarg', 0x4ace1]],
    },
    Credits: {
      note: 'The credits you can take when you plunder this person\'s ship: Credits ÷ 1,000 rounded down and halved, plus, when that is above 2, a number from 0 to one less than it drawn at random; that many thousands. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0], ['SetPlunderValues', 0x92219], ['Rand', 0xa4c76]],
    },
    GrantClass: {
      note: 'When you plunder this person\'s ship, with a chance of GrantProb in 100, you are given outfits of one oütf picked at random among those whose ItemClass is this and of which you do not have the most you can. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0], ['DoPlunderDialog', 0x9302b], ['HasMaxOfItem', 0x4512], ['GrantOutfitItem', 0x44d4f]],
    },
    GrantProb: {
      note: 'The chance in 100 of the GrantClass gift; kept between 0 and 100.',
      code: [['LoadObjectData', 0x771b0], ['DoPlunderDialog', 0x9302b]],
    },
    GrantCount: {
      note: 'How many of the GrantClass outfit are given: GrantCount × a number from 50 to 100 drawn at random ÷ 100, at least 1, and fewer while they would not fit your ship\'s free mass. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0], ['DoPlunderDialog', 0x9302b], ['ShipFreeMass', 0xb462], ['GrantOutfitItem', 0x44d4f]],
    },
    ShipType: {
      note: 'The class of this person\'s ship: 128 to 895. Anything else: shïp 128.',
      code: [['LoadObjectData', 0x771b0], ['SpawnPerson', 0x408d5]],
    },
    Govt: {
      note: 'The government of this person\'s ship. If that gövt has Flags 0x0800, the ship starts disabled and is never one jumping in.',
      code: [['SpawnPerson', 0x408d5]],
    },
    AIType: {
      note: 'How this person\'s ship flies, by the program\'s routines: 1 WimpyTraderAI, 2 BraveTraderAI, 3 WarshipAI (PirateWarshipAI if its government has Flags 0x1000), 4 InterceptorAI, above 4 EscortAI. 0 or less: the person is never picked by LinkSyst.',
      code: [['SpawnPerson', 0x408d5], ['AIDispatch', 0x8fb52], ['WimpyTraderAI', 0x8b029], ['BraveTraderAI', 0x8b493], ['WarshipAI', 0x8b729], ['PirateWarshipAI', 0x8c2d2], ['InterceptorAI', 0x8c895], ['EscortAI', 0x838d2]],
    },
    Aggress: {
      note: 'Kept for the ship as 1 when below 1, as given when 1 or 2, and as 4 when above 2.',
      code: [['SpawnPerson', 0x408d5]],
    },
    WeapType: {
      note: 'Weapons added to those of the ship\'s class, each 128 and up a wëap, WeapCount of it and AmmoLoad of its ammunition; one listed twice takes the later of the two. Below 128: none.',
      code: [['LoadObjectData', 0x771b0], ['SpawnPerson', 0x408d5]],
    },
    WeapCount: {
      note: 'How many of the WeapType beside it are added to the ship.',
      code: [['LoadObjectData', 0x771b0], ['SpawnPerson', 0x408d5]],
    },
    AmmoLoad: {
      note: 'Ammunition added for the WeapType beside it.',
      code: [['LoadObjectData', 0x771b0], ['SpawnPerson', 0x408d5]],
    },
    ShieldMod: {
      note: 'Above 0: the ship\'s shields and armour are ShieldMod per cent of its class\'s. 0 or less: as its class\'s.',
      code: [['LoadObjectData', 0x771b0], ['SpawnPerson', 0x408d5]],
    },
    HailQuote: {
      note: 'What this person\'s ship says when it hails you: the STR resource numbered HailQuote + 4999 where there is one, else entry HailQuote of STR# 7101. -1: it does not hail. It hails, while you can see it and it is not dying, jumping or leaving, 1 time in 140 each step and not within 2,700 ticks of its last, as Flags allows.',
      code: [['HandleShip', 0x33581], ['ShowPersonHailQuote', 0x4457e], ['LoadPluginString', 0x71a8e]],
    },
    LinkMission: {
      note: 'The mïsn this person offers: when you hail its ship, or with Flags 0x0200, when you board it, if the mission is available then (AvailLoc 2). -1: none.',
      code: [['HandlePlayerCommunication', 0x61f48], ['HandlePlayerBoardAttempt', 0x65000], ['IsMissionAvailable', 0x9b152], ['OfferOneMission', 0xa21ac]],
    },
    Flags: {
      note: '0x0001: damaging its ship gives it a grudge, and as a warship it then goes for you. 0x0002: when its ship is destroyed, it is not gone for good. HailQuote only: 0x0004, while it has a grudge; 0x0008, while it likes you; 0x0010, as it turns on you (then at once); 0x0020, while its ship is disabled; 0x0080, once; 0x0400, while its LinkMission is available; not 0x1000 if your ship class\'s InherentAI is 1, 0x2000 if 2, 0x4000 if 3 or more. 0x0040: once you accept its LinkMission, if that mission has one ship, this ship becomes it. 0x0100: once you accept its LinkMission, it is not met again. 0x0200: its LinkMission is offered on boarding, not hailing. 0x0800: once you accept its LinkMission, its ship leaves. 0x8000: with CommQuote -1, hailing it gives news of a disaster.',
      code: [['DamageShip', 0x3a807], ['SelectWarshipTarget', 0x89d5e], ['SpawnPerson', 0x408d5], ['HandleShipDisplay', 0x2b514], ['HandleShip', 0x33581], ['HandlePlayerCommunication', 0x61f48], ['HandlePlayerBoardAttempt', 0x65000], ['LoadAdvice', 0x9133c], ['AIDoesShipLikePlayer', 0x82177], ['IsThreatToPlayer', 0x7f501], ['AIMakeShipLeave', 0x7e2b0]],
    },
    Flags2: {
      note: '0x0001: its ship starts with no fuel, and cannot jump out while it has less than 100 units.',
      code: [['SpawnPerson', 0x408d5], ['AIShipHasFuelForJump', 0x7f48f], ['WarshipAI', 0x8b729]],
    },
    LinkSyst: {
      note: 'Where this person may be met among the ships a system\'s AvgShips brings, or among those jumping in later (1 time in 7 each). -1: anywhere. 128 to 9998: that sÿst; 0 to 127 count as 128 to 255. 9999: systems of no government; 10000 + n, of gövt 128 + n; 15000 + n, of its allies; 20000 + n, of another government; 25000 + n, of its enemies. Not among those jumping in if its government has Flags 0x0800. It is never picked while its AIType is 0 or less, its ActivateOn fails, it has been destroyed or captured, or it is already there.',
      code: [['SpawnPerson', 0x408d5], ['SetupShipsInSystem', 0x42b61], ['HyperShipSpawn', 0x4291a], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22]],
    },
    ActivateOn: {
      note: 'A test of control bits: while it fails, this person is not met, whether by LinkSyst or as a system\'s Person. Empty: no test.',
      code: [['SpawnPerson', 0x408d5], ['SetupShipsInSystem', 0x42b61], ['PropagateMissionBitEffects', 0x99676], ['EvalMissionBitTestString', 0x9959e]],
    },
  },
  'crön': {
    Contrib: {
      note: 'Added to your bits while the event is running: from the end of its PreHoldoff until it ends, not in its PostHoldoff. Your bits are those of your ship class, of every outfit you carry, of every ränk you hold and of every crön event that is running; the Require of a shïp, mïsn, crön or gövt, and an oütf\'s Requires, is met when they include every bit it sets.',
      code: [['CronEventHandler', 0x3874f], ['GetPlayerContributeBits', 0x76b2], ['PlayerMeetsRequirements', 0x776f]],
    },
  },
  'spöb': {
    Govt: {
      note: '128 and up is that gövt; anything less is no government.',
      code: [['LoadObjectData', 0x771b0]],
    },
    Tribute: {
      note: 'Credits added to yours each day once you have dominated the stellar; the player-info screen adds them up. 0 or less: TechLevel × 1,000.',
      code: [['LoadObjectData', 0x771b0], ['DoStellarTimePassage', 0x40867], ['PlayerInfoDialogUpdate', 0x5244f]],
    },
    Fee: {
      note: 'Credits taken when you land. With fewer, landing is refused ("You don\'t have enough…"). Not charged once you have dominated it. Above 0, the landing clearance says "[Landing fee is …]", or "[Docking fee is …]" with Flags 0x10, or "[Hypergate fee is …]" with Flags2 0x1000.',
      code: [['HandlePlayerDockRequest', 0x66691], ['HandlePlayerDockApproach', 0x647a6], ['DoPlanetCommDialog', 0x96949]],
    },
    Gravity: {
      note: 'While you are in its system, pulls every ship in it toward the stellar, however far: each step by Gravity × the game speed ÷ the square of the distance in hundreds of units, the square taken as at least 30. Below 0, it pushes instead; 0, nothing. Inertialess ships do not feel it, nor ship classes with Flags3 0x0020, nor your ship if it carries an outfit with ModType 41.',
      code: [['HandleGravity', 0x39bc3], ['ApplyGravity', 0x7c5a], ['ShipResistsGravity', 0x7b10]],
    },
    Weapon: {
      note: 'Below 128: none. It does not fire once destroyed.',
      code: [['LoadObjectData', 0x771b0], ['HandleStellarWeapons', 0x2ef3a]],
    },
    Strength: {
      note: 'Its strength to start with and its most. 0 or less: it is never destroyed.',
      code: [['LoadObjectData', 0x771b0], ['StellarIsDestroyed', 0x4e14]],
    },
    DeadType: {
      note: 'Above 255, or below 0: its own Type.',
      code: [['LoadObjectData', 0x771b0]],
    },
    ExplodType: {
      note: 'Below 0: none.',
      code: [['LoadObjectData', 0x771b0]],
    },
  },
};

/* A field's note, or null. */
function novaFieldNote(type, field) {
  const t = NOVA_FIELD_NOTES[type];
  return t && t[field] || null;
}
