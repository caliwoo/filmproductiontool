// Union/guild rest-period rules an AD would weigh when building a shooting
// schedule. Selecting one doesn't change how the auto-scheduler bin-packs
// scenes into days (it has no model of actual call/wrap times to check
// against a hard rest-hour minimum) -- it surfaces the applicable daily and
// weekly rest requirements as a reminder alongside the generated schedule,
// so the numbers a human reviewer needs are right there instead of in a
// separate document. The one rule input that DOES change the schedule
// itself is the 5-day/6-day workweek choice, which controls which calendar
// days are treated as rest days when assigning shoot dates.
export const SCHEDULE_RULES = [
  {
    key: 'sag_aftra',
    label: 'SAG-AFTRA (theatrical performers)',
    dailyRest:
      "12 hours in the studio zone, from dismissal to first call (includes makeup, wardrobe, hair). May be reduced to 10 hours on location for exterior photography (once every 4th consecutive day), or to 11 hours on an overnight location (any two non-consecutive days per workweek).",
    weeklyRest: {
      5: "56 hours, reduced to 54 hours if the following Monday's call is 6:00am or later.",
      6: '36 hours on a six-day location workweek.',
    },
    source: 'SAG-AFTRA Help Center',
  },
  {
    key: 'iatse_local80_basic',
    label: 'IATSE Local 80 (Basic Agreement)',
    dailyRest: '10 hours (9 for a distant hire, 8 for studio gang work), from dismissal to next call.',
    weeklyRest: {
      5: '54 hours after five days (50 hours in limited cases).',
      6: '32 hours after six days.',
    },
    source: 'IATSE Local 80 FAQ',
  },
  {
    key: 'iatse_low_budget',
    label: 'IATSE Low Budget Theatrical Agreement',
    dailyRest: "Check this production's agreement for its specific daily rest terms.",
    weeklyRest: {
      5: '52 hours.',
      6: '52 hours.',
    },
    source: 'IATSE Local 80 FAQ',
  },
  {
    key: 'iatse_area_standards',
    label: 'IATSE Area Standards Agreement',
    dailyRest:
      '10 hours for local/nearby hire (9 for a distant hire; 10 after two consecutive 14-hour days), following dismissal.',
    weeklyRest: {
      5: '54 hours after five days (50 hours in limited cases).',
      6: '32 hours after six days.',
    },
    source: 'ASA Article 3(F)',
  },
  {
    key: 'dga_upm_ad',
    label: 'DGA (UPMs and ADs)',
    dailyRest: '9 hours, from one hour after company wrap to one hour before the next shooting call.',
    weeklyRest: {
      5: 'Studio: 33 hours for one day off, or the 6th day is paid if a 14-hour day runs past 1:00am.',
      6: 'Studio: 50 hours for two days off, or the 6th/7th day is paid if a 14-hour day runs past 1:00am.',
    },
    source: 'DGA Basic Agreement 13-116; DGA rate card',
  },
  {
    key: 'minors_ca',
    label: 'Minors (California)',
    dailyRest: '12 hours, from dismissal to next call. Applies between any two workdays.',
    weeklyRest: {
      5: 'No separate weekly minimum beyond the 12-hour daily rest rule between workdays.',
      6: 'No separate weekly minimum beyond the 12-hour daily rest rule between workdays.',
    },
    source: 'Title 8 CCR 11760(i)',
  },
  {
    key: 'minors_ny',
    label: 'Minors (New York)',
    dailyRest: '12 hours, from dismissal to required arrival. Applies between any two workdays.',
    weeklyRest: {
      5: 'No separate weekly minimum beyond the 12-hour daily rest rule between workdays.',
      6: 'No separate weekly minimum beyond the 12-hour daily rest rule between workdays.',
    },
    source: '12 NYCRR Part 186-6.2(c)',
  },
];
