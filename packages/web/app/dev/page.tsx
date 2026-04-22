export default function DevPage() {
  if (process.env.NODE_ENV !== 'development') return null
  return <main>Dev</main>
}
