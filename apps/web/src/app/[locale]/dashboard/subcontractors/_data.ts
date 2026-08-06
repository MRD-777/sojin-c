export type SubContractorStatus = "active" | "inactive";
export type Specialty =
  | "electrical"
  | "plumbing"
  | "painting"
  | "ac"
  | "gypsum"
  | "ceramic"
  | "steel";

export type PhaseAssignmentStatus = "active" | "completed" | "terminated";

export interface PhaseAssignment {
  id: string;
  projectName: string;
  projectNameEn: string;
  phaseName: string;
  phaseNameEn: string;
  agreedCost: number;
  actualCost: number;
  status: PhaseAssignmentStatus;
  assignedAt: string;
}

export interface RatingEntry {
  id: string;
  date: string;
  by: string;
  byEn: string;
  rating: number;
  note: string;
  noteEn: string;
}

export interface SubContractor {
  id: string;
  name: string;
  nameEn: string;
  specialty: Specialty;
  phone: string;
  email?: string;
  rating: number;
  totalProjects: number;
  totalContractsValue: number;
  notes?: string;
  notesEn?: string;
  joinedAt: string;
  status: SubContractorStatus;
  avgDeviationPct: number;
  avgDailyCost: number;
  onTimeRate: number;
  current: PhaseAssignment[];
  history: PhaseAssignment[];
  ratings: RatingEntry[];
}

export const SUBCONTRACTORS: SubContractor[] = [
  {
    id: "SUB-001",
    name: "محمد عبدالله السيد",
    nameEn: "Mohamed Abdullah Elsayed",
    specialty: "electrical",
    phone: "010-2345-6789",
    email: "m.elsayed@elec.eg",
    rating: 4.2,
    totalProjects: 8,
    totalContractsValue: 450000,
    notes: "ملتزم بالمواعيد، يحتاج متابعة في فواتير المواد.",
    notesEn: "Punctual, needs follow-up on material invoices.",
    joinedAt: "2024-01-15",
    status: "active",
    avgDeviationPct: 8,
    avgDailyCost: 1200,
    onTimeRate: 85,
    current: [
      {
        id: "PA-001",
        projectName: "فيلا الشيخ زايد",
        projectNameEn: "Sheikh Zayed Villa",
        phaseName: "التمديدات الكهربائية",
        phaseNameEn: "Electrical Wiring",
        agreedCost: 85000,
        actualCost: 72000,
        status: "active",
        assignedAt: "2026-02-10",
      },
      {
        id: "PA-002",
        projectName: "برج النيل",
        projectNameEn: "Nile Tower",
        phaseName: "الإنهاءات الكهربائية",
        phaseNameEn: "Electrical Finishings",
        agreedCost: 120000,
        actualCost: 98000,
        status: "active",
        assignedAt: "2026-03-20",
      },
    ],
    history: [
      {
        id: "PA-H1",
        projectName: "مجمع الأهرام",
        projectNameEn: "Pyramids Complex",
        phaseName: "التمديدات الرئيسية",
        phaseNameEn: "Main Wiring",
        agreedCost: 95000,
        actualCost: 102000,
        status: "completed",
        assignedAt: "2025-04-01",
      },
    ],
    ratings: [
      {
        id: "R-001",
        date: "2026-01-15",
        by: "م. أحمد منصور",
        byEn: "Eng. Ahmed Mansour",
        rating: 4,
        note: "أداء متميز في برج النيل.",
        noteEn: "Excellent performance on Nile Tower.",
      },
      {
        id: "R-002",
        date: "2025-08-12",
        by: "م. سارة محمود",
        byEn: "Eng. Sarah Mahmoud",
        rating: 5,
        note: "تسليم قبل الموعد بأسبوع.",
        noteEn: "Delivered one week ahead of schedule.",
      },
    ],
  },
  {
    id: "SUB-002",
    name: "أحمد علي حسن",
    nameEn: "Ahmed Ali Hassan",
    specialty: "electrical",
    phone: "011-3456-7890",
    email: "ahmed.ali@power-co.eg",
    rating: 4.8,
    totalProjects: 12,
    totalContractsValue: 780000,
    notes: "الأفضل في فئته، أسعار مرتفعة.",
    notesEn: "Best in class, premium pricing.",
    joinedAt: "2023-08-20",
    status: "active",
    avgDeviationPct: 3,
    avgDailyCost: 1500,
    onTimeRate: 95,
    current: [
      {
        id: "PA-003",
        projectName: "مول العاصمة",
        projectNameEn: "Capital Mall",
        phaseName: "تشطيبات الإضاءة",
        phaseNameEn: "Lighting Finishes",
        agreedCost: 240000,
        actualCost: 235000,
        status: "active",
        assignedAt: "2026-03-01",
      },
    ],
    history: [],
    ratings: [
      {
        id: "R-003",
        date: "2026-03-05",
        by: "م. خالد عبدالله",
        byEn: "Eng. Khalid Abdullah",
        rating: 5,
        note: "احترافية عالية في كل المراحل.",
        noteEn: "High professionalism across all phases.",
      },
    ],
  },
  {
    id: "SUB-003",
    name: "خالد محمود إبراهيم",
    nameEn: "Khalid Mahmoud Ibrahim",
    specialty: "plumbing",
    phone: "012-1234-5678",
    rating: 3.5,
    totalProjects: 5,
    totalContractsValue: 180000,
    joinedAt: "2024-06-10",
    status: "active",
    avgDeviationPct: 22,
    avgDailyCost: 900,
    onTimeRate: 70,
    current: [
      {
        id: "PA-004",
        projectName: "شقق المعادي",
        projectNameEn: "Maadi Apartments",
        phaseName: "السباكة الصحية",
        phaseNameEn: "Sanitary Plumbing",
        agreedCost: 45000,
        actualCost: 55000,
        status: "active",
        assignedAt: "2026-04-15",
      },
    ],
    history: [],
    ratings: [],
  },
  {
    id: "SUB-004",
    name: "سامي رمضان",
    nameEn: "Sami Ramadan",
    specialty: "plumbing",
    phone: "010-5555-1234",
    email: "sami.r@plumbing.eg",
    rating: 4.0,
    totalProjects: 6,
    totalContractsValue: 220000,
    joinedAt: "2024-03-22",
    status: "active",
    avgDeviationPct: 6,
    avgDailyCost: 1100,
    onTimeRate: 88,
    current: [
      {
        id: "PA-005",
        projectName: "فيلا الشيخ زايد",
        projectNameEn: "Sheikh Zayed Villa",
        phaseName: "السباكة الرئيسية",
        phaseNameEn: "Main Plumbing",
        agreedCost: 55000,
        actualCost: 53000,
        status: "active",
        assignedAt: "2026-02-15",
      },
    ],
    history: [],
    ratings: [
      {
        id: "R-004",
        date: "2025-11-20",
        by: "م. أحمد منصور",
        byEn: "Eng. Ahmed Mansour",
        rating: 4,
        note: "جيد جداً، يحتاج تحسين في النظافة.",
        noteEn: "Very good, needs improvement in cleanliness.",
      },
    ],
  },
  {
    id: "SUB-005",
    name: "فاطمة الصياد للنقاشة",
    nameEn: "Fatima Elsayyad Painting",
    specialty: "painting",
    phone: "011-9999-8888",
    email: "fatima@paint.eg",
    rating: 4.6,
    totalProjects: 9,
    totalContractsValue: 310000,
    joinedAt: "2023-11-05",
    status: "active",
    avgDeviationPct: 4,
    avgDailyCost: 800,
    onTimeRate: 92,
    current: [],
    history: [
      {
        id: "PA-H2",
        projectName: "برج النيل",
        projectNameEn: "Nile Tower",
        phaseName: "الدهانات الداخلية",
        phaseNameEn: "Interior Paint",
        agreedCost: 65000,
        actualCost: 67000,
        status: "completed",
        assignedAt: "2025-09-10",
      },
    ],
    ratings: [],
  },
  {
    id: "SUB-006",
    name: "شركة التبريد المتقدمة",
    nameEn: "Advanced Cooling Co.",
    specialty: "ac",
    phone: "02-3344-5566",
    email: "info@advcool.eg",
    rating: 4.3,
    totalProjects: 7,
    totalContractsValue: 520000,
    joinedAt: "2024-02-12",
    status: "active",
    avgDeviationPct: 10,
    avgDailyCost: 1800,
    onTimeRate: 80,
    current: [
      {
        id: "PA-006",
        projectName: "مول العاصمة",
        projectNameEn: "Capital Mall",
        phaseName: "تركيب التكييف المركزي",
        phaseNameEn: "Central AC Installation",
        agreedCost: 380000,
        actualCost: 410000,
        status: "active",
        assignedAt: "2026-01-20",
      },
    ],
    history: [],
    ratings: [],
  },
  {
    id: "SUB-007",
    name: "ورشة الجبس الفني",
    nameEn: "Artisan Gypsum Workshop",
    specialty: "gypsum",
    phone: "010-7777-6666",
    rating: 3.9,
    totalProjects: 4,
    totalContractsValue: 95000,
    joinedAt: "2024-09-01",
    status: "active",
    avgDeviationPct: 12,
    avgDailyCost: 700,
    onTimeRate: 75,
    current: [],
    history: [],
    ratings: [],
  },
  {
    id: "SUB-008",
    name: "بلاط النخبة",
    nameEn: "Elite Tiles",
    specialty: "ceramic",
    phone: "012-8888-7777",
    rating: 3.1,
    totalProjects: 3,
    totalContractsValue: 80000,
    joinedAt: "2025-01-18",
    status: "inactive",
    avgDeviationPct: 25,
    avgDailyCost: 850,
    onTimeRate: 60,
    current: [],
    history: [
      {
        id: "PA-H3",
        projectName: "شقق المعادي",
        projectNameEn: "Maadi Apartments",
        phaseName: "تركيب البلاط",
        phaseNameEn: "Tile Installation",
        agreedCost: 40000,
        actualCost: 52000,
        status: "terminated",
        assignedAt: "2025-05-20",
      },
    ],
    ratings: [
      {
        id: "R-005",
        date: "2025-08-15",
        by: "م. خالد عبدالله",
        byEn: "Eng. Khalid Abdullah",
        rating: 2,
        note: "تجاوز كبير في التكلفة وتأخر في التسليم.",
        noteEn: "Major cost overrun and delivery delays.",
      },
    ],
  },
];

export function getSubcontractorById(id: string): SubContractor | undefined {
  return SUBCONTRACTORS.find((s) => s.id === id);
}
