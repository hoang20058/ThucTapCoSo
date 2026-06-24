import {
  Vault,
  Wrench,
  ChartColumnBig,
  Settings,
  Wand2,
  Upload
} from "lucide-react";

export const navigationGroups = [
  {
    label: "Kho",
    icon: Vault,
    path: "/app/vault"
  },
  {
    label: "Công cụ",
    icon: Wrench,
    children: [
      { label: "Trình tạo", icon: Wand2, path: "/app/tools/generator" },
      { label: "Nhập & Xuất", icon: Upload, path: "/app/tools/import-export" }
    ]
  },
  {
    label: "Báo cáo",
    icon: ChartColumnBig,
    path: "/app/reports"
  },
  {
    label: "Cài đặt bảo mật",
    icon: Settings,
    path: "/app/settings/security"
  }
];

export const defaultRoute = "/app/vault";
