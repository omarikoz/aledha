import soundPacksData from '../data/soundPacks.json';

class SoundPackManager {
  constructor() {
    this.packs = soundPacksData;
  }

  // Never persist unlocked state - PIN must be re-verified on every selection
  getAllPacks() {
    return this.packs.map((p) => ({
      ...p,
      isUnlocked: !p.requiresPin
    }));
  }

  getPackById(packId) {
    if (!packId) return null;
    const pack = this.packs.find((p) => p.id === packId);
    if (!pack) return null;
    return {
      ...pack,
      isUnlocked: !pack.requiresPin
    };
  }

  isPackUnlocked(packId) {
    const pack = this.packs.find((p) => p.id === packId);
    if (!pack) return true;
    return !pack.requiresPin;
  }

  // Verify PIN on demand without keeping permanent client unlock
  unlockPack(packId, pinCode) {
    const pack = this.packs.find((p) => p.id === packId);
    if (!pack) return { success: false, error: 'Sound pack not found.' };

    if (!pack.requiresPin) {
      return { success: true, pack };
    }

    const cleanInput = String(pinCode || '').trim();
    if (cleanInput === String(pack.pinCode).trim()) {
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
