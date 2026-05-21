export interface ActivityCategory {
  label: string;
  activities: string[];
}

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  {
    label: 'Play time',
    activities: [
      'Puzzles',
      'Blocks',
      'Pretend play',
      'Games',
      'Baby dolls',
      'Cars',
      'Sensory toys',
      'Playing (general)',
      'Sports (e.g., soccer, basketball)',
      'Screen time (e.g., movie/show, iPad/tablet/phone, video games)',
    ],
  },
  {
    label: 'Personal care',
    activities: [
      'Waking up',
      'Diapering',
      'Potty time',
      'Dressing',
      'Nap time',
      'Brushing teeth',
      'Bath time',
      'Bed time',
      'Sleeping',
    ],
  },
  {
    label: 'Outdoor play',
    activities: ['Ride-ons', 'Playing ball', 'Swinging', 'Sliding', 'Water play'],
  },
  {
    label: 'Eating & drinking',
    activities: ['Bottle time', 'Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Water breaks'],
  },
  {
    label: 'Outings',
    activities: [
      'Car rides',
      'Bus rides',
      'Walks',
      'Visiting family and friends',
      'Shopping',
      'Getting the mail',
      'Traveling to/from activity',
    ],
  },
  {
    label: 'Household chores',
    activities: [
      'Laundry',
      'Wiping up tables',
      'Throwing away trash',
      'Picking up toys',
      'Putting dishes in sink',
      'Clean-up, set-up, transition',
    ],
  },
  {
    label: 'Books & literacy',
    activities: [
      'Reading together',
      'Playing with cloth or board books',
      'Talking about pictures',
      'Reading or looking at books',
    ],
  },
  // {
  //   label: 'Structured activities',
  //   activities: [
  //     'Circle time',
  //     'Music time',
  //     'Library story time',
  //     'Story time',
  //     'Art',
  //     'Playdough',
  //     'Coloring',
  //     'Centers',
  //     'Large group',
  //     'Small group',
  //     'Individual activity',
  //     'Other',
  //     'School work',
  //     'Faith-based activities',
  //     'Therapy',
  //   ],
  // },
];

export const ALL_ACTIVITIES: string[] = ACTIVITY_CATEGORIES.flatMap(c => c.activities);
