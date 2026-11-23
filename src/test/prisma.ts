import { vi } from "vitest"

type Metodos = Record<string, ReturnType<typeof vi.fn>>

const modelos = new Map<string, Metodos>()

function modelo(nombre: string): Metodos {
  let m = modelos.get(nombre)
  if (!m) {
    m = new Proxy({} as Metodos, {
      get(target, prop: string) {
        target[prop] ??= vi.fn()
        return target[prop]
      },
    })
    modelos.set(nombre, m)
  }
  return m
}

/** Mock de Prisma: cada modelo y método se crea como vi.fn() la primera vez que se usa. */
export const prismaMock = new Proxy({} as Record<string, unknown>, {
  get(_t, prop: string) {
    if (prop === "$transaction") return transaction
    if (prop === "$queryRaw") return queryRaw
    return modelo(prop)
  },
}) as unknown as Record<string, Metodos> & { $transaction: ReturnType<typeof vi.fn>; $queryRaw: ReturnType<typeof vi.fn> }

const transaction = vi.fn(async (arg: unknown) => {
  if (typeof arg === "function") return (arg as (tx: unknown) => unknown)(prismaMock)
  return Promise.all(arg as Promise<unknown>[])
})
const queryRaw = vi.fn()

export function resetPrismaMock() {
  for (const m of modelos.values()) for (const k of Object.keys(m)) delete m[k]
  modelos.clear()
  transaction.mockClear()
  queryRaw.mockReset()
}

export const prismaModule = { prisma: prismaMock }
