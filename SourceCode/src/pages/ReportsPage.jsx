import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import PageHeader from "../components/shared/PageHeader";
import { evaluatePasswordStrength, extractUserInputs, containsPersonalInfo, getDomainName } from "../utils/password";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  KeyRound,
  Copy,
  AlertCircle,
  Globe2,
  UserRound
} from "lucide-react";

export default function ReportsPage() {
  const { vaults, userProfile, notify } = useApp();


  // Compute vault analytics locally on RAM
  const personalInputs = useMemo(() => {
    return extractUserInputs(userProfile);
  }, [userProfile]);

  const analytics = useMemo(() => {
    const total = vaults.length;
    let weakCount = 0;
    let duplicateCount = 0;
    let personalInfoCount = 0;

    // Grouping passwords to find duplicates using a hash map
    const pwdGroups = {};
    vaults.forEach((item) => {
      const pwd = String(item.password ?? "");
      if (!pwdGroups[pwd]) {
        pwdGroups[pwd] = [];
      }
      pwdGroups[pwd].push(item);
    });

    const duplicatePasswords = new Set();
    Object.entries(pwdGroups).forEach(([pwd, items]) => {
      if (items.length > 1 && pwd !== "") {
        duplicateCount += items.length;
        duplicatePasswords.add(pwd);
      }
    });

    // Evaluate each vault item for local vulnerabilities
    const itemsWithIssues = vaults.map((item, index) => {
      const pwdStr = String(item.password ?? "");
      const strength = evaluatePasswordStrength(pwdStr, [item.url, item.username], personalInputs);
      const isWeak = strength.score <= 1;
      const isDuplicate = duplicatePasswords.has(pwdStr);
      const hasPersonalInfo = containsPersonalInfo(pwdStr, personalInputs);

      if (isWeak) weakCount++;
      if (hasPersonalInfo) personalInfoCount++;

      const issues = [];
      if (isWeak) {
        issues.push({
          type: "weak",
          label: "Mật khẩu yếu",
          description: `Độ bảo mật thấp (Điểm: ${strength.score}/4)`,
          color: "text-red-500 bg-red-500/10 border-red-500/20 dark:text-red-400"
        });
      }
      if (isDuplicate) {
        issues.push({
          type: "duplicate",
          label: "Mật khẩu trùng lặp",
          description: "Mật khẩu đang được dùng chung với tài khoản khác",
          color: "text-amber-500 bg-amber-500/10 border-amber-500/20 dark:text-amber-400"
        });
      }
      if (hasPersonalInfo) {
        issues.push({
          type: "personal",
          label: "Chứa thông tin cá nhân",
          description: "Mật khẩu chứa Tên/Ngày sinh/SĐT của bạn",
          color: "text-rose-500 bg-rose-500/10 border-rose-500/20 dark:text-rose-400"
        });
      }

      return {
        ...item,
        originalIndex: index,
        issues
      };
    }).filter(item => item.issues.length > 0);

    return {
      total,
      weakCount,
      duplicateCount,
      personalInfoCount,
      itemsWithIssues
    };
  }, [vaults, personalInputs]);

  const copyPassword = async (password) => {
    try {
      await navigator.clipboard.writeText(password);
      notify("Đã sao chép mật khẩu", "success");
    } catch {
      notify("Không thể sao chép mật khẩu. Hãy thử lại.", "danger");
    }
  };

  // Configure summary card states based on analytics metrics
  const cards = [
    {
      title: "Tổng tài khoản",
      value: analytics.total,
      icon: KeyRound,
      color: "text-blue-500 bg-blue-500/10 border-blue-500/20 dark:text-blue-400",
      description: "Mục trong két sắt"
    },
    {
      title: "Mật khẩu yếu",
      value: analytics.weakCount,
      icon: ShieldAlert,
      color: analytics.weakCount > 0
        ? "text-red-500 bg-red-500/10 border-red-500/20 dark:text-red-400"
        : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400",
      description: "zxcvbn ≤ 1"
    },
    {
      title: "Trùng lặp",
      value: analytics.duplicateCount,
      icon: AlertTriangle,
      color: analytics.duplicateCount > 0
        ? "text-amber-500 bg-amber-500/10 border-amber-500/20 dark:text-amber-400"
        : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400",
      description: "Dùng lại mật khẩu"
    },
    {
      title: "Vi phạm thông tin",
      value: analytics.personalInfoCount,
      icon: AlertCircle,
      color: analytics.personalInfoCount > 0
        ? "text-rose-500 bg-rose-500/10 border-rose-500/20 dark:text-rose-400"
        : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400",
      description: "Chứa Tên/Ngày sinh/SĐT"
    }
  ];

  return (
    <section className="space-y-6 pb-12">
      <PageHeader
        eyebrow="Báo cáo bảo mật"
        title="Trung tâm An ninh"
        description="Đánh giá mật khẩu đang được lưu trữ"
      />

      {/* SECTION 1: Health Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className={`panel flex items-center justify-between p-5 border ${card.color}`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-app-muted">{card.title}</p>
                <p className="mt-2 text-3xl font-extrabold tracking-tight">{card.value}</p>
                <p className="mt-1 text-xs opacity-85">{card.description}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <Icon className="h-6 w-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Local Vault Diagnostics List */}
      <div className="panel p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-app-border pb-3">
          <div>
            <h3 className="text-lg font-bold text-app-text">Kết quả đánh giá</h3>
            <p className="text-sm text-app-muted">Phân tích rủi ro bảo mật</p>
          </div>
        </div>

        {analytics.itemsWithIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500 border border-emerald-500/20 dark:text-emerald-400">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h4 className="mt-3 text-base font-bold text-app-text">Két sắt an toàn cục bộ</h4>
            <p className="mt-1 max-w-md text-sm text-app-muted">
              Tuyệt vời! Không phát hiện mật khẩu nào bị yếu, trùng lặp hoặc chứa thông tin cá nhân của bạn.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-app-border">
            {analytics.itemsWithIssues.map((item, idx) => {
              const domain = getDomainName(item.url) || "unknown-site";
              return (
                <div key={idx} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-surface-alt text-app-primary">
                      <Globe2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold text-app-text">{domain}</h4>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-app-muted">
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="h-3 w-3" />
                          {item.username}
                        </span>
                        <span className="font-mono tracking-wider">• • • • • •</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {item.issues.map((issue, issueIdx) => (
                      <span
                        key={issueIdx}
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${issue.color}`}
                        title={issue.description}
                      >
                        {issue.label}
                      </span>
                    ))}
                    <button
                      className="icon-button h-8 w-8 ml-2"
                      onClick={() => copyPassword(item.password)}
                      title="Sao chép mật khẩu"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </section>
  );
}
