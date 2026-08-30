"use client";

import {
 ShoppingCart,
 Factory,
 AlertTriangle,
 CheckCircle2,
 TrendingUp,
 Package,
 Clock,
 User,
 Users,
 Shield,
 BarChart3,
 FileText,
 Settings,
 LayoutDashboard,
 Search,
 Bell,
 LogOut,
 Moon,
 Sun,
 ChevronDown,
 ChevronLeft,
 ChevronRight,
 Menu,
 X,
 Eye,
 Edit,
 Trash2,
 Download,
 Plus,
 Calendar,
 MapPin,
 Mail,
 Phone,
 MoreVertical,
 Lock,
 UserCheck,
 UserX,
 ArrowLeft,
 ArrowUpRight,
 ArrowDownRight,
 Minus,
 Smartphone,
 Monitor,
 Palette,
 Globe,
 Database,
 Key,
 MessageSquare,
 HardDrive,
} from "lucide-react";

export type IconName =
 | "ShoppingCart"
 | "Factory"
 | "AlertTriangle"
 | "CheckCircle2"
 | "TrendingUp"
 | "Package"
 | "Clock"
 | "User"
 | "Users"
 | "Shield"
 | "BarChart3"
 | "FileText"
 | "Settings"
 | "LayoutDashboard"
 | "Search"
 | "Bell"
 | "LogOut"
 | "Moon"
 | "Sun"
 | "ChevronDown"
 | "ChevronLeft"
 | "ChevronRight"
 | "Menu"
 | "X"
 | "Eye"
 | "Edit"
 | "Trash2"
 | "Download"
 | "Plus"
 | "Calendar"
 | "MapPin"
 | "Mail"
 | "Phone"
 | "MoreVertical"
 | "Lock"
 | "UserCheck"
 | "UserX"
 | "ArrowLeft"
 | "ArrowUpRight"
 | "ArrowDownRight"
 | "Minus"
 | "Smartphone"
 | "Monitor"
 | "Palette"
 | "Globe"
 | "Database"
 | "Key"
 | "MessageSquare"
 | "HardDrive"
 | "OrdersIcon"
 | "ProductionIcon"
 | "AlertIcon"
 | "CheckIcon";

export const iconMap: Record<IconName, React.ReactElement> = {
 ShoppingCart: <ShoppingCart className="w-5 h-5" />,
 Factory: <Factory className="w-5 h-5" />,
 AlertTriangle: <AlertTriangle className="w-5 h-5" />,
 CheckCircle2: <CheckCircle2 className="w-5 h-5" />,
 TrendingUp: <TrendingUp className="w-5 h-5" />,
 Package: <Package className="w-5 h-5" />,
 Clock: <Clock className="w-5 h-5" />,
 User: <User className="w-5 h-5" />,
 Users: <Users className="w-5 h-5" />,
 Shield: <Shield className="w-5 h-5" />,
 BarChart3: <BarChart3 className="w-5 h-5" />,
 FileText: <FileText className="w-5 h-5" />,
 Settings: <Settings className="w-5 h-5" />,
 LayoutDashboard: <LayoutDashboard className="w-5 h-5" />,
 Search: <Search className="w-5 h-5" />,
 Bell: <Bell className="w-5 h-5" />,
 LogOut: <LogOut className="w-5 h-5" />,
 Moon: <Moon className="w-5 h-5" />,
 Sun: <Sun className="w-5 h-5" />,
 ChevronDown: <ChevronDown className="w-5 h-5" />,
 ChevronLeft: <ChevronLeft className="w-5 h-5" />,
 ChevronRight: <ChevronRight className="w-5 h-5" />,
 Menu: <Menu className="w-5 h-5" />,
 X: <X className="w-5 h-5" />,
 Eye: <Eye className="w-5 h-5" />,
 Edit: <Edit className="w-5 h-5" />,
 Trash2: <Trash2 className="w-5 h-5" />,
 Download: <Download className="w-5 h-5" />,
 Plus: <Plus className="w-5 h-5" />,
 Calendar: <Calendar className="w-5 h-5" />,
 MapPin: <MapPin className="w-5 h-5" />,
 Mail: <Mail className="w-5 h-5" />,
 Phone: <Phone className="w-5 h-5" />,
 MoreVertical: <MoreVertical className="w-5 h-5" />,
 Lock: <Lock className="w-5 h-5" />,
 UserCheck: <UserCheck className="w-5 h-5" />,
 UserX: <UserX className="w-5 h-5" />,
 ArrowLeft: <ArrowLeft className="w-5 h-5" />,
 ArrowUpRight: <ArrowUpRight className="w-5 h-5" />,
 ArrowDownRight: <ArrowDownRight className="w-5 h-5" />,
 Minus: <Minus className="w-5 h-5" />,
 Smartphone: <Smartphone className="w-5 h-5" />,
 Monitor: <Monitor className="w-5 h-5" />,
 Palette: <Palette className="w-5 h-5" />,
 Globe: <Globe className="w-5 h-5" />,
 Database: <Database className="w-5 h-5" />,
 Key: <Key className="w-5 h-5" />,
 MessageSquare: <MessageSquare className="w-5 h-5" />,
 HardDrive: <HardDrive className="w-5 h-5" />,
 OrdersIcon: <ShoppingCart className="w-6 h-6" />,
 ProductionIcon: <Factory className="w-6 h-6" />,
 AlertIcon: <AlertTriangle className="w-6 h-6" />,
 CheckIcon: <CheckCircle2 className="w-6 h-6" />,
};

interface IconProps {
 name: IconName;
 className?: string;
}

export function Icon({ name, className = "" }: IconProps) {
 return <span className={className}>{iconMap[name]}</span>;
}

export function getIcon(name: IconName) {
 return iconMap[name];
}