export interface TranslationDictionary {
  app: {
    name: string;
    tagline: string;
  };
  nav: {
    home: string;
    transactions: string;
    quickAdd: string;
    walletsAndDebts: string;
    insights: string;
    settings: string;
    mainNavAria: string;
    languageToggleAria: string;
  };
  greeting: {
    morning: string;
    afternoon: string;
    evening: string;
    subtitle: string;
  };
  weekStrip: {
    ariaLabel: string;
    mon: string;
    tue: string;
    wed: string;
    thu: string;
    fri: string;
    sat: string;
    sun: string;
  };
  sync: {
    synced: string;
    syncing: string;
    pending: string;
    offline: string;
    error: string;
  };
  hero: {
    todaySpentLabel: string;
    monthSpentLabel: string;
    primaryCta: string;
    noSpendTodayBtn: string;
    noSpendCheckedIn: string;
    streakBadge: string;
    hideBalanceAria: string;
  };
  flows: {
    cost: string;
    earn: string;
    borrowLend: string;
    transfer: string;
  };
  accounts: {
    sectionTitle: string;
    netWorthLabel: string;
    spendableBadge: string;
    addAccountBtn: string;
    addPocketBtn: string;
    accountNameLabel: string;
    accountTypeLabel: string;
    currencyLabel: string;
    openingBalanceLabel: string;
    saveAccountBtn: string;
    archiveBtn: string;
    mainBankDemo: string;
    cashWalletDemo: string;
    eWalletDemo: string;
    creditCardDemo: string;
    bankType: string;
    cashType: string;
    eWalletType: string;
    savingsType: string;
    creditType: string;
  };
  checklist: {
    title: string;
    subtitle: string;
    progressPrefix: string;
    nextStepLabel: string;
    step2Title: string;
    step2Desc: string;
    actionAdd: string;
    actionSkipNA: string;
    completedBadge: string;
  };
  walletsTab: {
    segmentWallets: string;
    segmentDebts: string;
    walletsEmptyTitle: string;
    walletsEmptyDesc: string;
    debtsEmptyTitle: string;
    debtsEmptyDesc: string;
  };
  transactionsTab: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyDesc: string;
    viewModeAria: string;
    searchPlaceholder: string;
    filterAll: string;
    editBtn: string;
    deleteBtn: string;
    undoToastPrefix: string;
    undoBtn: string;
  };
  insightsTab: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyDesc: string;
  };
  quickAddModal: {
    title: string;
    editTitle: string;
    placeholder: string;
    hint: string;
    closeBtn: string;
    submitBtn: string;
    typeAria: string;
    categoryAria: string;
    sourcePocketLabel: string;
    destPocketLabel: string;
    receivedAmountLabel: string;
    transferFeeLabel: string;
    impliedFxPrefix: string;
    parsedPreviewLabel: string;
    tabExpense: string;
    tabIncome: string;
    tabTransfer: string;
  };
  calculator: {
    ariaLabel: string;
    clearBtn: string;
    backspaceAria: string;
    keyPrefixAria: string;
    computeEqualsBtn: string;
  };
  ledgerView: {
    modeList: string;
    modeCalendar: string;
    monthIncomeLabel: string;
    safeToSpendLabel: string;
  };
  settings: {
    title: string;
    subtitle: string;
    languageTitle: string;
    langEn: string;
    langVi: string;
    colorModeTitle: string;
    modeSystem: string;
    modeLight: string;
    modeDark: string;
    themePresetTitle: string;
    privacyTitle: string;
    hideBalancesLabel: string;
    storagePersistLabel: string;
    categoriesSeededLabel: string;
    categoriesCountSuffix: string;
    backHomeBtn: string;
  };
  themes: {
    popName: string;
    popDesc: string;
    cobaltName: string;
    cobaltDesc: string;
    matchaName: string;
    matchaDesc: string;
    flamingoName: string;
    flamingoDesc: string;
    sunnyName: string;
    sunnyDesc: string;
  };
  categories: Record<string, string>;
  m3: {
    reconcileBtn: string;
    reconcileTitle: string;
    appBalanceLabel: string;
    actualBalanceLabel: string;
    reconcileMatchedMsg: string;
    reconcileDeficitMsg: string;
    reconcileSurplusMsg: string;
    creditLimitLabel: string;
    remainingLimitLabel: string;
    currentDebtLabel: string;
    statementDayLabel: string;
    dueDayLabel: string;
    receivableTab: string;
    payableTab: string;
    addDebtBtn: string;
    counterpartyLabel: string;
    principalLabel: string;
    remainingLabel: string;
    originOpeningLabel: string;
    originLendBorrowLabel: string;
    recordRepayBtn: string;
    politeRemindBtn: string;
    copiedReminderMsg: string;
    settledBadge: string;
    recurringTitle: string;
    addRecurringBtn: string;
    dueConfirmBadge: string;
    confirmBtn: string;
    skipCycleBtn: string;
    installmentTermsLabel: string;
    paidForOthersToggle: string;
    paidForOthersCounterpartyPlaceholder: string;
    paidForOthersAmountPlaceholder: string;
    groupSummaryPrefix: string;
    yourExpensePrefix: string;
    lentToOthersPrefix: string;
  };
  m4: {
    vsLastMonthSamePeriod: string;
    upcomingRemindersTitle: string;
    periodWeek: string;
    periodMonth: string;
    periodAll: string;
    donutTitle: string;
    donutSubtitle: string;
    barTitle: string;
    barMode8Weeks: string;
    barModeDailyMonth: string;
    drillDownTitle: string;
    clearDrillDownBtn: string;
    weeklyRecapTitle: string;
    weeklyRecapSubtitle: string;
    top3CategoriesLabel: string;
    vsLastWeekLabel: string;
    privacyShareToggle: string;
    shareStoryBtn: string;
    storyCopiedNotice: string;
    unaccountedNoticePrefix: string;
  };
  m5: {
    streakTitle: string;
    freezeReadyBadge: string;
    freezeUsedBadge: string;
    welcomeBackMsg: string;
    catchUpPromptTitle: string;
    catchUpPromptDesc: string;
    catchUpQuickBtn: string;
    catchUpReconcileBtn: string;
    pwaCardTitle: string;
    pwaCardDesc: string;
    pwaInstallBtn: string;
    pwaInstalledBadge: string;
    enablePushBtn: string;
    pushEnabledBadge: string;
    notificationsTitle: string;
    notificationsSubtitle: string;
    notifDailyReminder: string;
    notifCreditCardDue: string;
    notifRecurringDue: string;
    notifDebtDue: string;
    notifWeeklyRecap: string;
    reminderHourLabel: string;
    quietHoursLabel: string;
    lockScreenPrivacyNote: string;
    themeUnlockDefault: string;
    themeUnlockStreak3: string;
    themeUnlockStreak7: string;
    themeUnlockStreak30OrChecklist: string;
    themeLockedBadge: string;
    themeUnlockedBadge: string;
    outboxSyncTitle: string;
    outboxPendingLabel: string;
    outboxFailedLabel: string;
    syncNowBtn: string;
    retryFailedBtn: string;
  };
}

export const en: TranslationDictionary = {
  app: {
    name: 'VOI',
    tagline: 'No more avoiding the elephant in the room — master your money with VOI',
  },
  nav: {
    home: 'Home',
    transactions: 'Ledger',
    quickAdd: 'Quick Add',
    walletsAndDebts: 'Assets & Debts',
    insights: 'Analytics',
    settings: 'Settings',
    mainNavAria: 'Primary navigation',
    languageToggleAria: 'Switch language',
  },
  greeting: {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    subtitle: 'VOI remembers every dong — your shield for financial peace.',
  },
  weekStrip: {
    ariaLabel: 'This week calendar',
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun',
  },
  sync: {
    synced: 'Synced',
    syncing: 'Syncing...',
    pending: 'Pending sync',
    offline: 'Offline — saved on device',
    error: 'Sync error',
  },
  hero: {
    todaySpentLabel: 'Spent Today',
    monthSpentLabel: 'This Month',
    primaryCta: 'Log your first expense',
    noSpendTodayBtn: 'No spend today ✨',
    noSpendCheckedIn: 'Zero-spend day checked in!',
    streakBadge: 'day streak',
    hideBalanceAria: 'Toggle balance visibility',
  },
  flows: {
    cost: 'Cost',
    earn: 'Earn',
    borrowLend: 'Borrow/Lend',
    transfer: 'Transfer',
  },
  accounts: {
    sectionTitle: 'Accounts & Net Worth',
    netWorthLabel: 'Total Net Worth',
    spendableBadge: 'Safe to spend',
    addAccountBtn: 'Add account',
    addPocketBtn: '+ Currency pocket',
    accountNameLabel: 'Account name',
    accountTypeLabel: 'Account type',
    currencyLabel: 'Currency',
    openingBalanceLabel: 'Opening balance',
    saveAccountBtn: 'Save account',
    archiveBtn: 'Archive',
    mainBankDemo: 'Main Bank (VCB)',
    cashWalletDemo: 'Cash Wallet',
    eWalletDemo: 'MoMo Wallet',
    creditCardDemo: 'VIB Credit Card',
    bankType: 'Bank Account',
    cashType: 'Cash',
    eWalletType: 'E-Wallet',
    savingsType: 'Savings',
    creditType: 'Credit Card',
  },
  checklist: {
    title: 'Complete your financial picture',
    subtitle: 'Set up your wallets, IOUs, and recurring bills in 7 quick steps.',
    progressPrefix: 'Progress',
    nextStepLabel: 'Next step',
    step2Title: 'Add an e-wallet or cash wallet',
    step2Desc: 'Track money smoothly across your bank, e-wallets, and cash.',
    actionAdd: 'Add now',
    actionSkipNA: 'Not applicable',
    completedBadge: 'Done',
  },
  walletsTab: {
    segmentWallets: 'Wallets & Cards',
    segmentDebts: 'Debts & Split Bills',
    walletsEmptyTitle: 'Manage all accounts, savings pockets & credit cards',
    walletsEmptyDesc:
      'Separate your actual balance from your true safe-to-spend money after goal pockets.',
    debtsEmptyTitle: 'Crystal-clear IOUs & bill splitting',
    debtsEmptyDesc:
      'Track who owes you, who you owe, lunch splits, and 1-tap settlements without awkwardness.',
  },
  transactionsTab: {
    title: 'Transaction Ledger',
    subtitle: 'Instant search and filter by category, account, or person.',
    emptyTitle: 'No transactions in this period yet',
    emptyDesc: 'Tap the center + button in the dock to log in 3 seconds.',
    viewModeAria: 'Ledger view mode',
    searchPlaceholder: 'Search note, category, or #tag...',
    filterAll: 'All',
    editBtn: 'Edit',
    deleteBtn: 'Delete',
    undoToastPrefix: 'Transaction deleted',
    undoBtn: 'Undo',
  },
  insightsTab: {
    title: 'Analytics & Budgets',
    subtitle: 'Review your spending habits with clean, judgment-free visual charts.',
    emptyTitle: 'Weekly & monthly insights will appear here',
    emptyDesc: 'After your first few entries, we will automatically visualize your trends.',
  },
  quickAddModal: {
    title: '3-Second Quick Add',
    editTitle: 'Edit Transaction',
    placeholder: 'e.g. coffee 45k, lunch 120k @Alex #team...',
    hint: 'Type naturally or use the built-in calculator (+ - × ÷) below.',
    closeBtn: 'Close',
    submitBtn: 'Save transaction',
    typeAria: 'Transaction type',
    categoryAria: 'Select category',
    sourcePocketLabel: 'From wallet / pocket',
    destPocketLabel: 'To wallet / pocket',
    receivedAmountLabel: 'Amount received (destination currency)',
    transferFeeLabel: 'Transfer fee (optional)',
    impliedFxPrefix: 'Implied FX rate',
    parsedPreviewLabel: 'Instant preview',
    tabExpense: 'Cost',
    tabIncome: 'Earn',
    tabTransfer: 'Transfer',
  },
  calculator: {
    ariaLabel: 'Money+ built-in calculator',
    clearBtn: 'Clear',
    backspaceAria: 'Delete one character',
    keyPrefixAria: 'Key',
    computeEqualsBtn: '= Calculate total',
  },
  ledgerView: {
    modeList: 'List',
    modeCalendar: 'Calendar',
    monthIncomeLabel: 'Monthly Income',
    safeToSpendLabel: 'Safe to Spend',
  },
  settings: {
    title: 'Settings & Appearance',
    subtitle: 'Customize language, 10% Pop Accent theme, and color mode.',
    languageTitle: 'Language / Ngôn ngữ',
    langEn: 'English (Default)',
    langVi: 'Tiếng Việt',
    colorModeTitle: 'Appearance Mode',
    modeSystem: 'System',
    modeLight: 'Light (Warm Cream)',
    modeDark: 'Dark (Warm OLED)',
    themePresetTitle: 'Accent Theme (Geometric Pop)',
    privacyTitle: 'Privacy & Local Data',
    hideBalancesLabel: 'Hide balances by default on launch',
    storagePersistLabel: 'Offline storage protection (IndexedDB Persistent)',
    categoriesSeededLabel: 'Default categories loaded in local DB',
    categoriesCountSuffix: 'categories',
    backHomeBtn: 'Back to Home',
  },
  themes: {
    popName: 'Coral Cost Pop',
    popDesc: 'Warm Coral Orange on Editorial Cream (#F7F4EB)',
    cobaltName: 'Electric Cobalt',
    cobaltDesc: 'Crisp, modern cobalt blue accent',
    matchaName: 'Mint Emerald',
    matchaDesc: 'Fresh emerald green representing asset growth',
    flamingoName: 'Lavender Amethyst',
    flamingoDesc: 'Playful GenZ lavender purple vibe',
    sunnyName: 'Honey Marigold',
    sunnyDesc: 'Warm golden honey like a daily savings jar',
  },
  categories: {
    'food-dining': 'Food & Dining',
    transport: 'Transport',
    'housing-bills': 'Housing & Bills',
    shopping: 'Shopping',
    'lifestyle-social': 'Lifestyle & Social',
    'health-personal': 'Health & Self-care',
    'education-work': 'Education & Work',
    'family-giving': 'Family & Gifts',
    'fees-interest': 'Fees & Interest',
    'eating-out': 'Eating Out / Lunch',
    'coffee-tea': 'Coffee & Boba',
    groceries: 'Groceries & Market',
    'food-delivery': 'Food Delivery',
    'ride-hailing': 'Ride-hailing & Taxi',
    'fuel-parking': 'Fuel & Parking',
    'vehicle-maintenance': 'Vehicle Maintenance',
    rent: 'Rent & Housing',
    utilities: 'Electricity, Water & Internet',
    'fashion-beauty': 'Fashion & Beauty',
    'home-electronics': 'Home & Electronics',
    'hangout-dating': 'Hangouts & Dating',
    'subscriptions-media': 'Movies, Music & Subs',
    travel: 'Travel & Getaways',
    salary: 'Primary Salary',
    bonus: 'Bonus & Commission',
    freelance: 'Freelance & Side Hustle',
    'investment-income': 'Savings & Investment Returns',
    'gifts-cashback': 'Gifts & Cashback',
    'internal-transfer': 'Internal Transfer',
    'credit-card-payment': 'Credit Card Payment',
    'balance-adjustment': 'Balance Adjustment',
    'unknown-expense': 'Unaccounted Expense',
    'unknown-income': 'Unaccounted Income',
  },
  m3: {
    reconcileBtn: 'Reconcile balance',
    reconcileTitle: 'Reconcile Actual Balance',
    appBalanceLabel: 'Current app balance',
    actualBalanceLabel: 'Actual balance in bank/wallet',
    reconcileMatchedMsg: 'Balance matches 100%! 🎉',
    reconcileDeficitMsg: 'Updated. Difference logged as unaccounted expense.',
    reconcileSurplusMsg: 'Updated. Difference logged as unaccounted income.',
    creditLimitLabel: 'Credit limit',
    remainingLimitLabel: 'Available limit',
    currentDebtLabel: 'Current card debt',
    statementDayLabel: 'Statement day',
    dueDayLabel: 'Due day',
    receivableTab: 'They Owe Me',
    payableTab: 'I Owe Others',
    addDebtBtn: '+ Add debt / IOU',
    counterpartyLabel: 'Person name',
    principalLabel: 'Principal',
    remainingLabel: 'Remaining',
    originOpeningLabel: 'Existing debt (opening balance)',
    originLendBorrowLabel: 'Lend / Borrow now from wallet',
    recordRepayBtn: 'Settle / Repay',
    politeRemindBtn: 'Friendly nudge ✨',
    copiedReminderMsg: 'Copied polite reminder!',
    settledBadge: 'Settled',
    recurringTitle: 'Recurring Bills & Installments',
    addRecurringBtn: '+ Add recurring / installment',
    dueConfirmBadge: 'Due — awaiting confirmation',
    confirmBtn: 'Confirm & Log',
    skipCycleBtn: 'Skip this cycle',
    installmentTermsLabel: 'Installment terms (optional, e.g. 12)',
    paidForOthersToggle: 'Split bill / Paid for others',
    paidForOthersCounterpartyPlaceholder: 'Friend name (e.g. Minh)',
    paidForOthersAmountPlaceholder: 'Amount paid for them',
    groupSummaryPrefix: 'Total paid',
    yourExpensePrefix: 'Your share',
    lentToOthersPrefix: 'Paid for others',
  },
  m4: {
    vsLastMonthSamePeriod: 'vs. same period last month',
    upcomingRemindersTitle: 'Upcoming Reminders',
    periodWeek: 'This Week',
    periodMonth: 'This Month',
    periodAll: 'All Time',
    donutTitle: 'Spending by Category',
    donutSubtitle: 'Tap any category below to inspect its transactions.',
    barTitle: 'Spending Trend',
    barMode8Weeks: '8 Weeks',
    barModeDailyMonth: 'Daily',
    drillDownTitle: 'Filtered Transactions',
    clearDrillDownBtn: 'Clear filter',
    weeklyRecapTitle: 'Weekly Story Recap',
    weeklyRecapSubtitle: 'Every Monday recap — judgment-free & ready to share.',
    top3CategoriesLabel: 'Top 3 Categories',
    vsLastWeekLabel: 'vs. last week',
    privacyShareToggle: 'Hide exact amounts when sharing image',
    shareStoryBtn: 'Share / Download Story Card',
    storyCopiedNotice: 'Story image ready to share!',
    unaccountedNoticePrefix: 'Includes unaccounted reconcile adjustment',
  },
  m5: {
    streakTitle: 'Daily Momentum & Streak Freeze',
    freezeReadyBadge: 'Weekly Streak Freeze active',
    freezeUsedBadge: 'Weekly Freeze protected your streak!',
    welcomeBackMsg: 'Welcome back! Let’s start a fresh streak together ✨',
    catchUpPromptTitle: 'Missed a few days? Quick catch-up',
    catchUpPromptDesc:
      'Log one rough estimate under "Unaccounted / Forgot" or reconcile your wallet balance.',
    catchUpQuickBtn: 'Quick log missed days',
    catchUpReconcileBtn: 'Reconcile wallet',
    pwaCardTitle: 'Install App & Gentle Reminders',
    pwaCardDesc: 'Open in <1.5s offline from your home screen with lock-screen safe reminders.',
    pwaInstallBtn: 'Install PWA App',
    pwaInstalledBadge: 'PWA Installed ✓',
    enablePushBtn: 'Enable Notifications',
    pushEnabledBadge: 'Notifications Active 🔔',
    notificationsTitle: 'Gentle Reminders & Quiet Hours',
    notificationsSubtitle: 'Max 2 per day. Never shows amounts or names on your lock screen.',
    notifDailyReminder: 'Daily check-in reminder (only if nothing logged)',
    notifCreditCardDue: 'Credit card due date (5 days & 1 day before)',
    notifRecurringDue: 'Recurring bills & installments (on due date)',
    notifDebtDue: 'Debt book due date (1 day before)',
    notifWeeklyRecap: 'Monday morning Weekly Story Recap',
    reminderHourLabel: 'Daily reminder hour',
    quietHoursLabel: 'Quiet hours (no notifications)',
    lockScreenPrivacyNote: '🔒 Lock-screen privacy: Zero money amounts or names in push payloads.',
    themeUnlockDefault: 'Unlocked by default',
    themeUnlockStreak3: 'Unlocks at 3-day streak',
    themeUnlockStreak7: 'Unlocks at 7-day streak',
    themeUnlockStreak30OrChecklist: 'Unlocks at 30-day streak or 7/7 Checklist',
    themeLockedBadge: 'Locked',
    themeUnlockedBadge: 'Unlocked',
    outboxSyncTitle: 'Offline Outbox & Cloud Sync',
    outboxPendingLabel: 'Pending sync items',
    outboxFailedLabel: 'Dead-letter (needs retry)',
    syncNowBtn: 'Sync now',
    retryFailedBtn: 'Retry failed items',
  },
};
