import React from 'react';
import {
  MapPin, Star, Heart, Bookmark, Flag, Sparkles, House, Compass,
  Utensils, Pizza, Sandwich, Soup, Salad, Beef, Fish, Drumstick,
  Croissant, CakeSlice, IceCreamCone, EggFried, Coffee, CupSoda, Beer, Wine,
  Martini, Music, PartyPopper, MicVocal, Disc3, Drama, Clapperboard, Tickets,
  Landmark, Castle, Church, BookOpen, Palette, Camera, ShoppingBag, Bed,
  Trees, TreePalm, Mountain, Waves, Tent, Plane, Bike, PawPrint,
  Trophy, Volleyball, Dumbbell, ShoppingBasket, Store, Sun, Car, Baby,
  type LucideIcon,
} from 'lucide-react';

// What lists.icon may hold. The key is Lucide's own icon name; the label is
// what the picker shows on hover and reads to screen readers.
export const LIST_ICONS: [string, LucideIcon, string][] = [
  ['map-pin', MapPin, 'Pin'],
  ['star', Star, 'Estrela'],
  ['heart', Heart, 'Coração'],
  ['bookmark', Bookmark, 'Salvo'],
  ['flag', Flag, 'Bandeira'],
  ['sparkles', Sparkles, 'Brilho'],
  ['house', House, 'Casa'],
  ['compass', Compass, 'Bússola'],
  ['utensils', Utensils, 'Restaurante'],
  ['pizza', Pizza, 'Pizza'],
  ['sandwich', Sandwich, 'Lanche'],
  ['soup', Soup, 'Sopa'],
  ['salad', Salad, 'Salada'],
  ['beef', Beef, 'Carne'],
  ['fish', Fish, 'Peixe'],
  ['drumstick', Drumstick, 'Frango'],
  ['croissant', Croissant, 'Padaria'],
  ['cake-slice', CakeSlice, 'Doce'],
  ['ice-cream-cone', IceCreamCone, 'Sorvete'],
  ['egg-fried', EggFried, 'Café da manhã'],
  ['coffee', Coffee, 'Café'],
  ['cup-soda', CupSoda, 'Bebida'],
  ['beer', Beer, 'Cerveja'],
  ['wine', Wine, 'Vinho'],
  ['martini', Martini, 'Drinque'],
  ['music', Music, 'Música'],
  ['party-popper', PartyPopper, 'Festa'],
  ['mic-vocal', MicVocal, 'Show'],
  ['disc-3', Disc3, 'Balada'],
  ['drama', Drama, 'Teatro'],
  ['clapperboard', Clapperboard, 'Cinema'],
  ['tickets', Tickets, 'Evento'],
  ['landmark', Landmark, 'Monumento'],
  ['castle', Castle, 'Castelo'],
  ['church', Church, 'Igreja'],
  ['book-open', BookOpen, 'Livros'],
  ['palette', Palette, 'Arte'],
  ['camera', Camera, 'Foto'],
  ['shopping-bag', ShoppingBag, 'Compras'],
  ['shopping-basket', ShoppingBasket, 'Mercado'],
  ['store', Store, 'Loja'],
  ['bed', Bed, 'Hospedagem'],
  ['trees', Trees, 'Parque'],
  ['tree-palm', TreePalm, 'Praia'],
  ['mountain', Mountain, 'Montanha'],
  ['waves', Waves, 'Mar'],
  ['sun', Sun, 'Sol'],
  ['tent', Tent, 'Camping'],
  ['plane', Plane, 'Viagem'],
  ['car', Car, 'Carro'],
  ['trophy', Trophy, 'Esporte'],
  ['volleyball', Volleyball, 'Vôlei'],
  ['dumbbell', Dumbbell, 'Academia'],
  ['bike', Bike, 'Bicicleta'],
  ['paw-print', PawPrint, 'Pet'],
  ['baby', Baby, 'Crianças'],
];

const BY_KEY = new Map(LIST_ICONS.map(([key, Icon]) => [key, Icon]));

// Same fallback color the map uses for a place without a list.
const NO_LIST_COLOR = '#FF5C38';
const INK = '#1E1E1E';
const WHITE = '#FFFFFF';

function luminance(hex: string) {
  const m = /^#?([0-9a-f]{6})/i.exec(hex || '');
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

// Ink or white, whichever has the higher contrast on the given background.
export function inkOn(background: string) {
  const l = luminance(background);
  const contrastInk = (l + 0.05) / (luminance(INK) + 0.05);
  const contrastWhite = (1.05) / (l + 0.05);
  return contrastInk >= contrastWhite ? INK : WHITE;
}

function initial(name?: string) {
  const m = /[\p{L}\p{N}]/u.exec(name || '');
  return m ? m[0].toUpperCase() : '·';
}

type ListLike = { name?: string; icon?: string | null; color?: string } | null | undefined;

// The bare glyph: the list's icon, or the first letter of its name in the
// display font when it has none. A missing list means "no list", the pin.
export function ListGlyph({ list, size, color = 'currentColor', strokeWidth }: {
  list: ListLike; size: number; color?: string; strokeWidth?: number;
}) {
  const Icon = list ? BY_KEY.get(list.icon || '') : MapPin;
  if (Icon) {
    return <Icon size={size} color={color} strokeWidth={strokeWidth ?? (size <= 14 ? 2.5 : 2)} aria-hidden="true" style={{ flexShrink: 0 }} />;
  }
  return (
    <span aria-hidden="true" style={{
      fontFamily: 'var(--display-font)', fontWeight: 400, fontSize: Math.round(size * 1.05), lineHeight: 1,
      color, display: 'inline-block', transform: 'translateY(0.04em)',
    }}>{initial(list?.name)}</span>
  );
}

// The list's badge: a flat tile in the list's color with the glyph on top.
export function ListIcon({ list, size = 40, radius }: { list: ListLike; size?: number; radius?: number }) {
  const background = list?.color || NO_LIST_COLOR;
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: radius ?? Math.round(size * 0.28), background,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <ListGlyph list={list} size={Math.round(size * 0.54)} color={inkOn(background)} />
    </span>
  );
}
