import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolView } from 'expo-symbols';
import {
  ArrowLeft,
  ArrowUpDown,
  Calendar,
  ChevronRight,
  ChevronsUpDown,
  ClipboardPaste,
  Copy,
  Download,
  FileText,
  Gauge,
  Headphones,
  Keyboard,
  LifeBuoy,
  MoreHorizontal,
  Plus,
  QrCode,
  RotateCw,
  Send,
  Settings,
  Share2,
  Trash2,
  Wifi,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Platform } from 'react-native';

export type PlatformIconName =
  | 'settings'
  | 'plus'
  | 'refresh'
  | 'gauge'
  | 'more'
  | 'support'
  | 'send'
  | 'traffic'
  | 'calendar'
  | 'server'
  | 'chevron'
  | 'file'
  | 'wifi'
  | 'trash'
  | 'back'
  | 'copy'
  | 'qr'
  | 'share'
  | 'clipboard'
  | 'keyboard'
  | 'download'
  | 'close';

interface PlatformIconProps {
  name: PlatformIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const iosNames: Record<PlatformIconName, string> = {
  settings: 'gearshape',
  plus: 'plus',
  refresh: 'arrow.clockwise',
  gauge: 'gauge.with.dots.needle.67percent',
  more: 'ellipsis',
  support: 'headphones',
  send: 'paperplane',
  traffic: 'arrow.up.arrow.down',
  calendar: 'calendar',
  server: 'chevron.up.chevron.down',
  chevron: 'chevron.right',
  file: 'doc.text',
  wifi: 'wifi',
  trash: 'trash',
  back: 'arrow.left',
  copy: 'doc.on.doc',
  qr: 'qrcode',
  share: 'square.and.arrow.up',
  clipboard: 'doc.on.clipboard',
  keyboard: 'keyboard',
  download: 'square.and.arrow.down',
  close: 'xmark',
};

const androidNames: Record<PlatformIconName, string> = {
  settings: 'settings',
  plus: 'add',
  refresh: 'refresh',
  gauge: 'speed',
  more: 'more-horiz',
  support: 'headset',
  send: 'send',
  traffic: 'swap-vert',
  calendar: 'calendar-today',
  server: 'unfold-more',
  chevron: 'chevron-right',
  file: 'description',
  wifi: 'wifi',
  trash: 'delete-outline',
  back: 'arrow-back',
  copy: 'content-copy',
  qr: 'qr-code',
  share: 'share',
  clipboard: 'content-paste',
  keyboard: 'keyboard',
  download: 'file-download',
  close: 'close',
};

const webIcons: Record<PlatformIconName, LucideIcon> = {
  settings: Settings,
  plus: Plus,
  refresh: RotateCw,
  gauge: Gauge,
  more: MoreHorizontal,
  support: Headphones,
  send: Send,
  traffic: ArrowUpDown,
  calendar: Calendar,
  server: ChevronsUpDown,
  chevron: ChevronRight,
  file: FileText,
  wifi: Wifi,
  trash: Trash2,
  back: ArrowLeft,
  copy: Copy,
  qr: QrCode,
  share: Share2,
  clipboard: ClipboardPaste,
  keyboard: Keyboard,
  download: Download,
  close: X,
};

export function PlatformIcon({
  name,
  size = 20,
  color = '#FFFFFF',
  strokeWidth = 1.8,
}: PlatformIconProps) {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView name={iosNames[name] as never} size={size} tintColor={color} weight="regular" />
    );
  }
  if (Platform.OS === 'android') {
    return <MaterialIcons name={androidNames[name] as never} size={size} color={color} />;
  }
  const Icon = webIcons[name];
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}
