// types/app.ts

/** ——— Rôles utilisateurs ——— */
export type Role = "admin" | "vendor" | "staff" | "customer";

/** ——— Utilisateurs ——— */
 
export type UserDoc = {
  id: string;
  email: string;
  displayName?: string;
  role: Role;                 // 'customer' par défaut
  vendorStatus?: VendorStatus; // contrôle d’accès vendeur
  vendorApplicationId?: string;
  createdAt: any;
};

/** Product */
export type Product = {
  id: string;
  vendorId: string;  // = uid
  vendorName: string;  // = uid
  name: string;
  price?: number;
  stock?: number;
  images?: string[];
  createdAt: any;

  // publication & modération
  published: boolean;         // visible sur le front si true
  approval?: 'draft'|'pending'|'approved'|'rejected';
  status?: boolean | 'draft' | 'active' | 'archived';
  blocked?: boolean;
  blockedAt?: any;
  blockedBy?: string;
  blockedByUid?: string;
  blockedReason?: string;
  homePage?: boolean;
  active?: boolean;
  isActive?: boolean;
  pricing?: {
    basePrice?: number;
    currency?: string;
    taxClass?: string;
  };
  inventory?: {
    stock?: number;
  };
  core?: {
    vendorId?: string;
    vendorName?: string;
    title?: string;
    status?: 'draft'|'active'|'archived';
    active?: boolean;
    isActive?: boolean;
    blocked?: boolean;
    blockedReason?: string;
    pricing?: {
      basePrice?: number;
      currency?: string;
      taxClass?: string;
    };
    inventory?: {
      stock?: number;
    };
    updatedAt?: any;
  };
  draft?: {
    core?: Product['core'];
    updatedAt?: any;
  };
};


/** ——— Commandes ——— */
export type OrderItem = {
  productId: string;
  qty: number;
  price?: number;
};

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "delivered"
  | "cancelled";

export type Order = {
  id: string;
  userId: string; // client qui commande
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: any;
  vendorId?: string; // optionnel si multi-vendeur
  vendorName?: string; // optionnel si multi-vendeur
  driverId?: string; // livreur assigné
};

/** ——— Applications vendeur & livreur ——— */
export type FileLike = File | null;

/** Vendor (vendeur) */
export interface VendorForm {
  companyName: string;
  legalForm: "Entreprise individuelle" | "SARL" | "SA" | "SAS" | "SNC";
  repName: string;
  address: string;
  zip: string;
  city: string;
  email: string;
  phone: string;
  website: string;
  iban?: string;
  orangeMoney?: string;
  merchantCode?: string;
  repIdFile: FileLike;

  gewerbeFile: FileLike;
  handelsregisterFile: FileLike;
  steuernummer: string;
  ustIdNr: string;
  kleinunternehmer: boolean;
  impressumUrl: string;
  cgvUrl: string;
  widerrufUrl: string;

  isFoodBusiness: boolean;
  lmuRegistrationFile: FileLike;
  ifsgFile: FileLike;
  haccpFile: FileLike;
  liabilityFile: FileLike;
  coldChain: boolean;

  productTypes: string;
  openingHours: string;
  pickupAddresses: string;
  opsContact: string;

  acceptTos: boolean;
  acceptPrivacy: boolean;
  attestTrue: boolean;
}

export type VendorErrors = Partial<Record<keyof VendorForm, string>>;
 
 
// lib/types.ts
export type VendorStatus =
  | 'draft'
  | 'submitted'
  | 'needs_docs'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'blocked'

export type LegalForm = 'Entreprise individuelle' | 'SARL' | 'SA' | 'SAS' | 'SNC'
export const LEGAL_FORMS: LegalForm[] = ['Entreprise individuelle','SARL','SA','SAS','SNC']
export const isLegalForm = (v: string): v is LegalForm => (LEGAL_FORMS as string[]).includes(v)

export type VendorDocKey = 'repId'|'gewerbe'|'handelsregister'|'ifsg'|'haccp'|'liability'|'foodRegistration' 

export type VendorProfile = {
  uid: string
  lockEdits: boolean
  lockCatalog: boolean
  status: VendorStatus
  active?: boolean
  isActive?: boolean
  blocked?: boolean
  blockedAt?: any
  blockedBy?: string
  blockedByUid?: string
  blockedReason?: string
  approvedBy?: string
  approvedByUid?: string
  docsRequired: boolean
  requiredDocs: VendorDocKey[]
  company: {
    name: string; legalForm: LegalForm; representative: string;
    address: string; zip: string; city: string; email: string; phone: string; website?: string
  }
  bank: { iban?: string; orangeMoney?: string; merchantCode?: string }
  legal: {
    steuernummer: string; ustIdNr?: string; kleinunternehmer: boolean;
    impressumUrl: string; cgvUrl: string; widerrufUrl: string
  }
  food: { isFoodBusiness: boolean; coldChain: boolean }
  ops: { productTypes?: string; openingHours?: string; pickupAddresses?: string; opsContact?: string }
  consent: { acceptTos: boolean; acceptPrivacy: boolean; attestTrue: boolean; contactConsent: boolean }
  submittedAt?: any; approvedAt?: any
} 

export type VendorDocument = {
  id: string
  uid?: string
  userId?: string
  vendorId?: string
  vendorName?: string
  ownerId?: string
  vendorStatus?: VendorStatus
  status?: VendorStatus
  active?: boolean
  isActive?: boolean
  blocked?: boolean
  lockCatalog?: boolean
  lockEdits?: boolean
  blockedAt?: any
  blockedBy?: string
  blockedByUid?: string
  blockedReason?: string
  approvedAt?: any
  approvedBy?: string
  approvedByUid?: string
  profile?: VendorProfile
  company?: VendorProfile["company"]
  legal?: VendorProfile["legal"]
  bank?: VendorProfile["bank"]
  ops?: VendorProfile["ops"]
  food?: VendorProfile["food"]
  consent?: VendorProfile["consent"]
  requiredDocs?: VendorDocKey[]
}



