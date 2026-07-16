import fs from "fs";
import path from "path";
import initialDbData from "../data/db.json";

export interface Item {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  status: "AVAILABLE" | "ALLOCATED" | "MAINTENANCE" | "RETIRED";
  conditionOnCheckIn: string;
  currentAllocationId: string | null;
}

export interface Beneficiary {
  id: string;
  name: string;
  phone: string; // WhatsApp format (+91...)
  address: string;
  volunteerInCharge: string;
}

export interface Allocation {
  id: string;
  itemId: string;
  beneficiaryId: string;
  allocatedAt: string; // ISO String
  expectedReturnAt: string; // ISO String
  actualReturnedAt: string | null; // ISO String
  status: "ACTIVE" | "RETURNED" | "OVERDUE";
  notes: string;
  receiptNumber: string;
}

interface Database {
  items: Item[];
  beneficiaries: Beneficiary[];
  allocations: Allocation[];
}

const IS_VERCEL = process.env.VERCEL === "1";
const DB_PATH = IS_VERCEL
  ? path.join("/tmp", "db.json")
  : path.join(process.cwd(), "data", "db.json");

function readDb(): Database {
  try {
    if (!fs.existsSync(DB_PATH)) {
      // Ensure the directory exists
      fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
      fs.writeFileSync(DB_PATH, JSON.stringify(initialDbData, null, 2), "utf8");
      return initialDbData as unknown as Database;
    }
    const data = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(data) as Database;
  } catch (error) {
    console.error("Failed to read database:", error);
    return initialDbData as unknown as Database;
  }
}

function writeDb(db: Database): boolean {
  try {
    // Ensure directory exists
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Failed to write database:", error);
    return false;
  }
}

export const dbService = {
  // --- ITEMS ---
  async getItems(): Promise<Item[]> {
    const db = readDb();
    // Update overdue status dynamically for allocations, which might affect items?
    // Not directly, but we can verify status.
    return db.items;
  },

  async getItemById(id: string): Promise<Item | undefined> {
    const db = readDb();
    return db.items.find((item) => item.id === id);
  },

  async createItem(itemData: Omit<Item, "id">): Promise<Item> {
    const db = readDb();
    const newItem: Item = {
      ...itemData,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    db.items.push(newItem);
    writeDb(db);
    return newItem;
  },

  async updateItem(id: string, updates: Partial<Item>): Promise<Item | null> {
    const db = readDb();
    const index = db.items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    
    db.items[index] = { ...db.items[index], ...updates };
    writeDb(db);
    return db.items[index];
  },

  async deleteItem(id: string): Promise<boolean> {
    const db = readDb();
    const index = db.items.findIndex((item) => item.id === id);
    if (index === -1) return false;
    
    db.items.splice(index, 1);
    // Also clean up any active allocations referencing this item
    db.allocations = db.allocations.filter((a) => a.itemId !== id);
    writeDb(db);
    return true;
  },

  // --- BENEFICIARIES ---
  async getBeneficiaries(): Promise<Beneficiary[]> {
    const db = readDb();
    return db.beneficiaries;
  },

  async getBeneficiaryById(id: string): Promise<Beneficiary | undefined> {
    const db = readDb();
    return db.beneficiaries.find((b) => b.id === id);
  },

  async createBeneficiary(benData: Omit<Beneficiary, "id">): Promise<Beneficiary> {
    const db = readDb();
    // Check if beneficiary with same phone already exists
    const existing = db.beneficiaries.find((b) => b.phone === benData.phone);
    if (existing) {
      return existing;
    }
    const newBen: Beneficiary = {
      ...benData,
      id: `ben-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    db.beneficiaries.push(newBen);
    writeDb(db);
    return newBen;
  },

  // --- ALLOCATIONS ---
  async getAllocations(): Promise<(Allocation & { item?: Item; beneficiary?: Beneficiary })[]> {
    const db = readDb();
    const now = new Date();
    
    return db.allocations.map((alloc) => {
      const item = db.items.find((i) => i.id === alloc.itemId);
      const beneficiary = db.beneficiaries.find((b) => b.id === alloc.beneficiaryId);
      
      // Determine if overdue
      let status = alloc.status;
      if (alloc.status === "ACTIVE" && new Date(alloc.expectedReturnAt) < now) {
        status = "OVERDUE";
      }

      return {
        ...alloc,
        status,
        item,
        beneficiary,
      };
    });
  },

  async getAllocationById(id: string): Promise<(Allocation & { item?: Item; beneficiary?: Beneficiary }) | undefined> {
    const db = readDb();
    const alloc = db.allocations.find((a) => a.id === id);
    if (!alloc) return undefined;

    const item = db.items.find((i) => i.id === alloc.itemId);
    const beneficiary = db.beneficiaries.find((b) => b.id === alloc.beneficiaryId);

    return {
      ...alloc,
      item,
      beneficiary,
    };
  },

  async createAllocation(
    allocData: Omit<Allocation, "id" | "receiptNumber" | "status" | "actualReturnedAt">
  ): Promise<Allocation> {
    const db = readDb();
    const year = new Date().getFullYear();
    const prefix = `REC-${year}`;
    const seq = db.allocations.length + 1;
    const receiptNumber = `${prefix}-${seq.toString().padStart(4, "0")}`;

    const newAlloc: Allocation = {
      ...allocData,
      id: `alloc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      receiptNumber,
      status: "ACTIVE",
      actualReturnedAt: null,
    };

    // Update the item status
    const itemIndex = db.items.findIndex((i) => i.id === allocData.itemId);
    if (itemIndex !== -1) {
      db.items[itemIndex].status = "ALLOCATED";
      db.items[itemIndex].currentAllocationId = newAlloc.id;
    }

    db.allocations.push(newAlloc);
    writeDb(db);
    return newAlloc;
  },

  async returnAllocation(
    allocationId: string,
    actualReturnedAt: string,
    conditionOnCheckIn: string
  ): Promise<Allocation | null> {
    const db = readDb();
    const allocIndex = db.allocations.findIndex((a) => a.id === allocationId);
    if (allocIndex === -1) return null;

    const alloc = db.allocations[allocIndex];
    alloc.actualReturnedAt = actualReturnedAt;
    alloc.status = "RETURNED";

    // Update item status and condition
    const itemIndex = db.items.findIndex((i) => i.id === alloc.itemId);
    if (itemIndex !== -1) {
      const checkInCond = conditionOnCheckIn.toLowerCase();
      
      // Determine new item status based on condition
      let itemStatus: Item["status"] = "AVAILABLE";
      if (checkInCond === "needs repair") {
        itemStatus = "MAINTENANCE";
      } else if (checkInCond === "retired") {
        itemStatus = "RETIRED";
      }

      db.items[itemIndex].status = itemStatus;
      db.items[itemIndex].conditionOnCheckIn = conditionOnCheckIn;
      db.items[itemIndex].currentAllocationId = null;
    }

    writeDb(db);
    return alloc;
  },
};
