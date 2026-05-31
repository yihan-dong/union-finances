export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

/** Exchange rate: how many KHR per 1 USD */
export const KHR_RATE = 4000

/** Convert any amount to USD equivalent */
export function toUSD(amount: number, currency: 'USD' | 'KHR' = 'USD'): number {
  return currency === 'KHR' ? amount / KHR_RATE : amount
}

export function formatCurrency(amount: number, currency: 'USD' | 'KHR' = 'USD'): string {
  if (currency === 'KHR') {
    return '៛' + Math.round(Math.abs(amount)).toLocaleString('en-US')
  }
  return '$' + Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
  return `${months[d.getMonth()]} ${d.getDate()}`
}
