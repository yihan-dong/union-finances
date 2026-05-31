export type UserIdentity = 'yihan' | 'sun' | 'sokim' | 'sambath'
export type CoupleId = 'union' | 'sokimbath'
export type PaidByType = UserIdentity | 'both'
export type BucketType = 'utility' | 'status'
export type CurrencyType = 'USD' | 'KHR'
export type ExpenseCategory = 'food & dining' | 'rent & utilities' | 'transport' | 'shopping' | 'health' | 'entertainment' | 'travel' | 'subscriptions' | 'other'
export type IncomeType = 'salary' | 'freelance' | 'investment' | 'gift' | 'other'

export interface Expense {
  id: string
  amount: number
  description: string
  category: ExpenseCategory
  date: string
  paid_by: PaidByType
  bucket: BucketType
  currency: CurrencyType
  note: string | null
  couple: CoupleId
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
  couple: CoupleId
  created_at: string
}

export interface Budget {
  id: string
  category: ExpenseCategory
  monthly_limit: number
  owner: 'yihan' | 'sun' | 'sokim' | 'sambath' | 'shared'
  month: number
  year: number
  couple: CoupleId
}

export interface Goal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  deadline: string | null
  owner: string
  color: string | null
  couple: CoupleId
  created_at: string
}
