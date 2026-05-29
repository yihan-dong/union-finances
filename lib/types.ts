export type UserIdentity = 'yihan' | 'sun'
export type SplitType = 'even' | 'yihan' | 'sun'
export type ExpenseCategory = 'food & dining' | 'rent & utilities' | 'transport' | 'shopping' | 'health' | 'entertainment' | 'travel' | 'subscriptions' | 'other'
export type IncomeType = 'salary' | 'freelance' | 'investment' | 'gift' | 'other'

export interface Expense {
  id: string
  amount: number
  description: string
  category: ExpenseCategory
  date: string
  paid_by: UserIdentity
  split: SplitType
  note: string | null
  created_at: string
}

export interface Income {
  id: string
  amount: number
  source: string
  type: IncomeType
  owner: UserIdentity
  date: string
  recurring: boolean
  created_at: string
}

export interface Budget {
  id: string
  category: ExpenseCategory
  monthly_limit: number
  owner: 'yihan' | 'sun' | 'shared'
  month: number
  year: number
}

export interface Goal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  deadline: string | null
  owner: 'yihan' | 'sun' | 'both'
  color: string | null
  created_at: string
}
