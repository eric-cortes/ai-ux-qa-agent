import { getRequestConfig } from 'next-intl/server'

const NAMESPACES = [
  'metadata',
  'header',
  'form',
  'pipeline',
  'runs',
  'detail',
  'evidence',
  'findings',
  'errors',
  'labels',
  'common',
  'a11y',
] as const

export default getRequestConfig(async () => {
  const locale = 'en'
  const modules = await Promise.all(
    NAMESPACES.map(namespace => import(`../messages/${locale}/${namespace}.json`))
  )
  const messages = Object.fromEntries(
    NAMESPACES.map((namespace, index) => [namespace, modules[index].default])
  )
  return { locale, messages, timeZone: 'UTC' }
})
