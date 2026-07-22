export interface Course {
  code: string;
  name: string;
  ltp: string;
  credits: number;
  type: string;
  color: string;
  rooms?: string[];
  defaultRoom: string;
}

export interface ClassSlot {
  id: string;
  day: 'Mon' | 'Tue' | 'Wed' | 'Thur' | 'Fri';
  dayFull: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  startTime: string; // e.g. "10:00 AM"
  endTime: string;   // e.g. "10:55 AM"
  slotIndex: number; // 0..8
  subjectCode: string;
  multiRooms?: string[]; // Available choices e.g. ['NC241', 'NC244']
  defaultRoom: string;
  labSpan?: number; // Span across multiple periods (e.g., 3 periods for lab)
}

export interface StudentInfo {
  name: string;
  rollNo: string;
  dept: string;
  courseName: string;
  regDate: string;
  session: string;
  totalCredits: number;
}

export const STUDENT_INFO: StudentInfo = {
  name: "Gundubogula Nageswara Venkata Durga Sai",
  rollNo: "24CS10097",
  dept: "Computer Science and Engineering",
  courseName: "COMPUTER SCIENCE & ENGG. (B.Tech 4Y)",
  regDate: "08-JUL-2026",
  session: "AUTUMN, 2026-2027",
  totalCredits: 24.0,
};

export const COURSES: Record<string, Course> = {
  CS61064: {
    code: 'CS61064',
    name: 'HIGH PERFORMANCE PARALLEL PROGRAMMING',
    ltp: '3-1-0',
    credits: 4,
    type: 'Depth Elective I',
    color: '#8b5cf6', // Violet
    defaultRoom: 'CSE-120',
  },
  CS39001: {
    code: 'CS39001',
    name: 'COMPUTER ORGANIZATION LABORATORY',
    ltp: '0-0-6',
    credits: 4,
    type: 'Depth CORE XXXIV',
    color: '#ec4899', // Pink
    defaultRoom: 'Lab',
  },
  CS31005: {
    code: 'CS31005',
    name: 'ALGORITHMS -II',
    ltp: '3-1-0',
    credits: 4,
    type: 'Depth CORE XXXII',
    color: '#3b82f6', // Blue
    rooms: ['NC231', 'NC232'],
    defaultRoom: 'NC231', // User explicitly specified NC231
  },
  CS31007: {
    code: 'CS31007',
    name: 'COMPUTER ORGANIZATION & ARCHITECTURE',
    ltp: '3-1-0',
    credits: 4,
    type: 'Depth CORE XXXIII',
    color: '#06b6d4', // Cyan
    rooms: ['NC241', 'NC244'],
    defaultRoom: 'NC241', // User explicitly specified NC241
  },
  AI60213: {
    code: 'AI60213',
    name: 'FOUNDATION OF LARGE LANGUAGE MODELS',
    ltp: '3-0-0',
    credits: 3,
    type: 'Breadth Elective II',
    color: '#10b981', // Emerald
    defaultRoom: 'NR213',
  },
  CS31003: {
    code: 'CS31003',
    name: 'COMPILERS',
    ltp: '3-0-0',
    credits: 3,
    type: 'Depth CORE XXX',
    color: '#f59e0b', // Amber
    rooms: ['NC241', 'NC242'],
    defaultRoom: 'NC241', // User explicitly specified NC241
  },
  CS39003: {
    code: 'CS39003',
    name: 'COMPILERS LABORATORY',
    ltp: '0-0-3',
    credits: 2,
    type: 'Depth CORE XXXI',
    color: '#ef4444', // Red
    defaultRoom: 'Lab',
  },
};

export const TIME_SLOTS = [
  { index: 0, timeLabel: '8:00 AM - 8:55 AM', start: '08:00', end: '08:55' },
  { index: 1, timeLabel: '9:00 AM - 9:55 AM', start: '09:00', end: '09:55' },
  { index: 2, timeLabel: '10:00 AM - 10:55 AM', start: '10:00', end: '10:55' },
  { index: 3, timeLabel: '11:00 AM - 11:55 AM', start: '11:00', end: '11:55' },
  { index: 4, timeLabel: '12:00 PM - 12:55 PM', start: '12:00', end: '12:55' },
  { index: 5, timeLabel: '2:00 PM - 2:55 PM', start: '14:00', end: '14:55' },
  { index: 6, timeLabel: '3:00 PM - 3:55 PM', start: '15:00', end: '15:55' },
  { index: 7, timeLabel: '4:00 PM - 4:55 PM', start: '16:00', end: '16:55' },
  { index: 8, timeLabel: '5:00 PM - 5:55 PM', start: '17:00', end: '17:55' },
];

export const SCHEDULE_GRID: ClassSlot[] = [
  // MONDAY
  {
    id: 'mon-10am',
    day: 'Mon',
    dayFull: 'Monday',
    startTime: '10:00 AM',
    endTime: '10:55 AM',
    slotIndex: 2,
    subjectCode: 'CS31007',
    multiRooms: ['NC241', 'NC244'],
    defaultRoom: 'NC241',
  },
  {
    id: 'mon-11am',
    day: 'Mon',
    dayFull: 'Monday',
    startTime: '11:00 AM',
    endTime: '11:55 AM',
    slotIndex: 3,
    subjectCode: 'AI60213',
    defaultRoom: 'NR213',
  },
  {
    id: 'mon-12pm',
    day: 'Mon',
    dayFull: 'Monday',
    startTime: '12:00 PM',
    endTime: '12:55 PM',
    slotIndex: 4,
    subjectCode: 'CS31003',
    multiRooms: ['NC241', 'NC242'],
    defaultRoom: 'NC241',
  },
  {
    id: 'mon-lab',
    day: 'Mon',
    dayFull: 'Monday',
    startTime: '2:00 PM',
    endTime: '4:55 PM',
    slotIndex: 5,
    subjectCode: 'CS39001',
    defaultRoom: 'Lab',
    labSpan: 3,
  },

  // TUESDAY
  {
    id: 'tue-8am',
    day: 'Tue',
    dayFull: 'Tuesday',
    startTime: '8:00 AM',
    endTime: '8:55 AM',
    slotIndex: 0,
    subjectCode: 'AI60213',
    defaultRoom: 'NR213',
  },
  {
    id: 'tue-9am',
    day: 'Tue',
    dayFull: 'Tuesday',
    startTime: '9:00 AM',
    endTime: '9:55 AM',
    slotIndex: 1,
    subjectCode: 'AI60213',
    defaultRoom: 'NR213',
  },
  {
    id: 'tue-10am',
    day: 'Tue',
    dayFull: 'Tuesday',
    startTime: '10:00 AM',
    endTime: '10:55 AM',
    slotIndex: 2,
    subjectCode: 'CS31003',
    multiRooms: ['NC241', 'NC242'],
    defaultRoom: 'NC241',
  },
  {
    id: 'tue-11am',
    day: 'Tue',
    dayFull: 'Tuesday',
    startTime: '11:00 AM',
    endTime: '11:55 AM',
    slotIndex: 3,
    subjectCode: 'CS31003',
    multiRooms: ['NC241', 'NC242'],
    defaultRoom: 'NC241',
  },
  {
    id: 'tue-lab',
    day: 'Tue',
    dayFull: 'Tuesday',
    startTime: '3:00 PM',
    endTime: '5:55 PM',
    slotIndex: 6,
    subjectCode: 'CS39003',
    defaultRoom: 'Lab',
    labSpan: 3,
  },

  // WEDNESDAY
  {
    id: 'wed-8am',
    day: 'Wed',
    dayFull: 'Wednesday',
    startTime: '8:00 AM',
    endTime: '8:55 AM',
    slotIndex: 0,
    subjectCode: 'CS31007',
    multiRooms: ['NC241', 'NC244'],
    defaultRoom: 'NC241',
  },
  {
    id: 'wed-9am',
    day: 'Wed',
    dayFull: 'Wednesday',
    startTime: '9:00 AM',
    endTime: '9:55 AM',
    slotIndex: 1,
    subjectCode: 'CS31007',
    multiRooms: ['NC241', 'NC244'],
    defaultRoom: 'NC241',
  },
  {
    id: 'wed-10am',
    day: 'Wed',
    dayFull: 'Wednesday',
    startTime: '10:00 AM',
    endTime: '10:55 AM',
    slotIndex: 2,
    subjectCode: 'CS61064',
    defaultRoom: 'CSE-120',
  },
  {
    id: 'wed-lab',
    day: 'Wed',
    dayFull: 'Wednesday',
    startTime: '2:00 PM',
    endTime: '4:55 PM',
    slotIndex: 5,
    subjectCode: 'CS39001',
    defaultRoom: 'Lab',
    labSpan: 3,
  },

  // THURSDAY
  {
    id: 'thu-9am',
    day: 'Thur',
    dayFull: 'Thursday',
    startTime: '9:00 AM',
    endTime: '9:55 AM',
    slotIndex: 1,
    subjectCode: 'CS61064',
    defaultRoom: 'CSE-120',
  },
  {
    id: 'thu-10am',
    day: 'Thur',
    dayFull: 'Thursday',
    startTime: '10:00 AM',
    endTime: '10:55 AM',
    slotIndex: 2,
    subjectCode: 'CS31007',
    multiRooms: ['NC241', 'NC244'],
    defaultRoom: 'NC241',
  },
  {
    id: 'thu-3pm',
    day: 'Thur',
    dayFull: 'Thursday',
    startTime: '3:00 PM',
    endTime: '3:55 PM',
    slotIndex: 6,
    subjectCode: 'CS31005',
    multiRooms: ['NC231', 'NC232'],
    defaultRoom: 'NC231',
  },
  {
    id: 'thu-4pm',
    day: 'Thur',
    dayFull: 'Thursday',
    startTime: '4:00 PM',
    endTime: '4:55 PM',
    slotIndex: 7,
    subjectCode: 'CS31005',
    multiRooms: ['NC231', 'NC232'],
    defaultRoom: 'NC231',
  },

  // FRIDAY
  {
    id: 'fri-11am',
    day: 'Fri',
    dayFull: 'Friday',
    startTime: '11:00 AM',
    endTime: '11:55 AM',
    slotIndex: 3,
    subjectCode: 'CS61064',
    defaultRoom: 'CSE-120',
  },
  {
    id: 'fri-12pm',
    day: 'Fri',
    dayFull: 'Friday',
    startTime: '12:00 PM',
    endTime: '12:55 PM',
    slotIndex: 4,
    subjectCode: 'CS61064',
    defaultRoom: 'CSE-120',
  },
  {
    id: 'fri-2pm',
    day: 'Fri',
    dayFull: 'Friday',
    startTime: '2:00 PM',
    endTime: '2:55 PM',
    slotIndex: 5,
    subjectCode: 'CS31005',
    multiRooms: ['NC231', 'NC232'],
    defaultRoom: 'NC231',
  },
  {
    id: 'fri-3pm',
    day: 'Fri',
    dayFull: 'Friday',
    startTime: '3:00 PM',
    endTime: '3:55 PM',
    slotIndex: 6,
    subjectCode: 'CS31005',
    multiRooms: ['NC231', 'NC232'],
    defaultRoom: 'NC231',
  },
];
