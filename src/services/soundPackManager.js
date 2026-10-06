import soundPacksData from '../data/soundPacks.json';

const UNLOCKED_PACKS_KEY = 'aledha_unlocked_packs_v1';

class SoundPackManager {
  constructor() {
    this.packs = soundPacksData;
    this.unlockedPacks = this.loadUnlockedPacks();
  }

  loadUnlockedPacks() {
    try {
      const stored = localStorage.getItem(UNLOCKED_PACKS_KEY);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Could not load unlocked packs from storage:', e);
    }
    return new Set();
  }

  saveUnlockedPacks() {
    try {
      localStorage.setItem(UNLOCKED_PACKS_KEY, JSON.stringify(Array.from(this.unlockedPacks)));
    } catch (e) {
      console.warn('Could not save unlocked packs to storage:', e);
    }
  }

  getAllPacks() {
    return this.packs.map((p) => ({
      ...p,
      isUnlocked: !p.requiresPin || this.unlockedPacks.has(p.id)
    }));
  }

  getPackById(packId) {
    const pack = this.packs.find((p) => p.id === packId) || this.packs[0];
    return {
      ...pack,
      isUnlocked: !pack.requiresPin || this.unlockedPacks.has(pack.id)
    };
  }

  isPackUnlocked(packId) {
    const pack = this.packs.find((p) => p.id === packId);
    if (!pack) return true;
    if (!pack.requiresPin) return true;
    return this.unlockedPacks.has(packId);
  }

  unlockPack(packId, pinCode) {
    const pack = this.packs.find((p) => p.id === packId);
    if (!pack) return { success: false, error: 'Sound pack not found.' };

    if (!pack.requiresPin) {
      this.unlockedPacks.add(packId);
      this.saveUnlockedPacks();
      return { success: true };
    }

    const cleanInput = String(pinCode || '').trim();
    if (cleanInput === String(pack.pinCode).trim()) {
      this.unlockedPacks.add(packId);
      this.saveUnlockedPacks();
      return { success: true, pack };
    }

    return { success: false, error: 'Incorrect PIN code. Access denied.' };
  }

  getSoundsForPack(packId, category = 'all') {
    const pack = this.getPackById(packId);
    const sounds = pack?.sounds || [];
    if (!category || category === 'all') return sounds;
    const filtered = sounds.filter((s) => s.category === category);
    return filtered.length > 0 ? filtered : sounds;
  }
}

export const soundPackManager = new SoundPackManager();
