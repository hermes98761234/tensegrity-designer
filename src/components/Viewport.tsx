import { useEffect, useRef } from 'react'
import { BufferGeometry, Color, CylinderGeometry, DirectionalLight, AmbientLight, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Raycaster, Scene, SphereGeometry, Vector2, Vector3, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Analysis } from '../lib/analysis'

interface Props {
  analysis: Analysis | null
  /** Changes when the camera should be re-fitted (a different preset). */
  fitKey: string
  labels: boolean
  rotate: boolean
  selected: number | null
  onSelect: (k: number | null) => void
}

const LOW = new Color('#3b82f6')
const HIGH = new Color('#ef4444')
const STRUT = new Color('#9aa3b5')
const PICK = new Color('#f59e0b')
const UP = new Vector3(0, 1, 0)
// structure coordinates are z-up, three.js is y-up
const toView = (p: ArrayLike<number>, i: number) => new Vector3(p[3 * i], p[3 * i + 2], -p[3 * i + 1])

interface Live {
  scene: Scene
  camera: PerspectiveCamera
  controls: OrbitControls
  group: Group
  fit: (a: Analysis) => void
  nodes: Vector3[]
}

export default function Viewport({ analysis, fitKey, labels, rotate, selected, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const labelHost = useRef<HTMLDivElement>(null)
  const live = useRef<Live | null>(null)
  const pick = useRef(onSelect)
  const showLabels = useRef(labels)
  const members = useRef<Mesh[]>([])
  useEffect(() => {
    pick.current = onSelect
    showLabels.current = labels
  })

  // renderer, camera, controls and the render loop
  useEffect(() => {
    const el = host.current!
    const renderer = new WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.prepend(renderer.domElement)
    const scene = new Scene()
    scene.add(new AmbientLight(0xffffff, 1.6))
    const sun = new DirectionalLight(0xffffff, 2.2)
    sun.position.set(3, 5, 4)
    scene.add(sun)
    const camera = new PerspectiveCamera(40, 1, 0.01, 1000)
    camera.position.set(2, 1.4, 2.6)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    const group = new Group()
    scene.add(group)
    const l: Live = {
      scene,
      camera,
      controls,
      group,
      nodes: [],
      fit: (a) => {
        const pts = a.pos
        const c = new Vector3()
        const n = pts.length / 3
        for (let i = 0; i < n; i++) c.add(toView(pts, i))
        c.divideScalar(n)
        let r = 1e-6
        for (let i = 0; i < n; i++) r = Math.max(r, toView(pts, i).distanceTo(c))
        controls.target.copy(c)
        camera.position.copy(c).add(new Vector3(0.9, 0.55, 1.1).normalize().multiplyScalar(r * 3.0 * Math.max(1, 1 / camera.aspect)))
        camera.near = r / 100
        camera.far = r * 100
        camera.updateProjectionMatrix()
        controls.update()
      },
    }
    live.current = l

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el
      renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()

    // click (without dragging) selects a member
    const ray = new Raycaster()
    let down: Vector2 | null = null
    const onDown = (e: PointerEvent) => (down = new Vector2(e.clientX, e.clientY))
    const onUp = (e: PointerEvent) => {
      if (!down || down.distanceTo(new Vector2(e.clientX, e.clientY)) > 4) return
      const r = renderer.domElement.getBoundingClientRect()
      ray.setFromCamera(new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
      const hit = ray.intersectObjects(members.current)[0]
      pick.current(hit ? (hit.object.userData.k as number) : null)
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)

    let raf = 0
    const tmp = new Vector3()
    const loop = () => {
      raf = requestAnimationFrame(loop)
      controls.update()
      renderer.render(scene, camera)
      const lh = labelHost.current
      if (lh) {
        const show = showLabels.current
        lh.style.display = show ? '' : 'none'
        if (show) {
          const w = el.clientWidth
          const h = el.clientHeight
          l.nodes.forEach((p, i) => {
            const d = lh.children[i] as HTMLElement | undefined
            if (!d) return
            tmp.copy(p).project(camera)
            d.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, -130%)`
            d.style.opacity = tmp.z < 1 ? '1' : '0'
          })
        }
      }
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      live.current = null
    }
  }, [])

  useEffect(() => {
    if (live.current) live.current.controls.autoRotate = rotate
    if (live.current) live.current.controls.autoRotateSpeed = 1.2
  }, [rotate])

  // rebuild the meshes when the analysis changes
  const fitted = useRef<string | null>(null)
  useEffect(() => {
    const l = live.current
    if (!l || !analysis) return
    const { group } = l
    for (const o of [...group.children]) {
      group.remove(o)
      const m = o as Mesh
      m.geometry.dispose()
      ;(m.material as MeshStandardMaterial).dispose()
    }
    const { pos, rows, design } = analysis
    const n = design.labels.length
    l.nodes = Array.from({ length: n }, (_, i) => toView(pos, i))
    const strutLen = rows.filter((r) => r.type === 'strut').reduce((s, r) => s + r.length, 0) / (rows.filter((r) => r.type === 'strut').length || 1) || 1
    const rStrut = strutLen * 0.022
    const rCable = strutLen * 0.006
    const maxT = Math.max(...rows.map((r) => (r.type === 'cable' ? r.force : 0)), 1e-12)
    const minT = Math.min(...rows.filter((r) => r.type === 'cable').map((r) => r.force), maxT)
    const cyl = new CylinderGeometry(1, 1, 1, 14, 1)
    const list: Mesh[] = []
    design.members.forEach((m, k) => {
      const a = l.nodes[m.a]
      const b = l.nodes[m.b]
      const strut = m.type === 'strut'
      const color = strut ? STRUT.clone() : LOW.clone().lerp(HIGH, maxT > minT ? (rows[k].force - minT) / (maxT - minT) : 0.5)
      const mesh = new Mesh(cyl.clone() as BufferGeometry, new MeshStandardMaterial({ color, roughness: strut ? 0.35 : 0.6, metalness: strut ? 0.5 : 0 }))
      const dir = b.clone().sub(a)
      const rad = strut ? rStrut : rCable
      mesh.scale.set(rad, dir.length(), rad)
      mesh.position.copy(a).add(b).multiplyScalar(0.5)
      mesh.quaternion.setFromUnitVectors(UP, dir.normalize())
      mesh.userData = { k, color: color.clone(), rad, strut }
      group.add(mesh)
      list.push(mesh)
    })
    members.current = list
    const ball = new SphereGeometry(rStrut * 1.5, 16, 12)
    for (const p of l.nodes) {
      const s = new Mesh(ball.clone(), new MeshStandardMaterial({ color: '#e5e7eb', roughness: 0.4 }))
      s.position.copy(p)
      group.add(s)
    }
    if (fitted.current !== fitKey) {
      fitted.current = fitKey
      l.fit(analysis)
    }
  }, [analysis, fitKey])

  // highlight the selected member
  useEffect(() => {
    members.current.forEach((m) => {
      const on = m.userData.k === selected
      const mat = m.material as MeshStandardMaterial
      mat.color.copy(on ? PICK : (m.userData.color as Color))
      mat.emissive.set(on ? '#7c4a03' : '#000000')
      m.scale.x = m.scale.z = (m.userData.rad as number) * (on ? 1.8 : 1)
    })
  }, [selected, analysis])

  return (
    <div className="viewport" ref={host}>
      <div className="vp-labels" ref={labelHost} aria-hidden="true">
        {analysis?.design.labels.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
    </div>
  )
}
