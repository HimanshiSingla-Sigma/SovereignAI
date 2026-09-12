import { useMemo, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { BAYS, type FloorMachine } from './bays'
import { useSettingsStore } from '@/store/settingsStore'

const BAY_SPACING = 5.2
const SLOT_SPACING = 4.6

// ==============================================================================
// 1. CAMERA CONTROLLER WITH ORBITCONTROLS & SMOOTH FOCUS INTERPOLATION
// ==============================================================================

interface CameraControllerProps {
  focusPosition: [number, number, number] | null
  onUserOrbit?: () => void
}

function CameraController({ focusPosition, onUserOrbit }: CameraControllerProps) {
  const { camera, gl } = useThree()
  const controlsRef = useRef<OrbitControls | null>(null)
  const isTransitioning = useRef(false)
  const targetCameraPos = useRef(new THREE.Vector3(0, 13, 19))
  const targetLookAt = useRef(new THREE.Vector3(0, 1, 0))

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI / 2 - 0.04 // Keep camera above the floor
    controls.minDistance = 3.0
    controls.maxDistance = 50.0
    controls.target.set(0, 1, 0)
    controlsRef.current = controls

    const handleStart = () => {
      isTransitioning.current = false
      onUserOrbit?.()
    }
    controls.addEventListener('start', handleStart)

    return () => {
      controls.removeEventListener('start', handleStart)
      controls.dispose()
    }
  }, [camera, gl.domElement, onUserOrbit])

  // When focusPosition changes, trigger smooth lerp transition
  useEffect(() => {
    if (focusPosition) {
      targetLookAt.current.set(focusPosition[0], focusPosition[1] + 1.2, focusPosition[2])
      targetCameraPos.current.set(focusPosition[0], focusPosition[1] + 3.8, focusPosition[2] + 6.2)
      isTransitioning.current = true
    } else {
      targetLookAt.current.set(0, 1, 0)
      targetCameraPos.current.set(0, 13, 19)
      isTransitioning.current = true
    }
  }, [focusPosition])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls) return

    if (isTransitioning.current) {
      const step = Math.min(1, delta * 4.2)
      controls.target.lerp(targetLookAt.current, step)
      camera.position.lerp(targetCameraPos.current, step)

      if (
        controls.target.distanceTo(targetLookAt.current) < 0.04 &&
        camera.position.distanceTo(targetCameraPos.current) < 0.04
      ) {
        controls.target.copy(targetLookAt.current)
        camera.position.copy(targetCameraPos.current)
        isTransitioning.current = false
      }
    }

    controls.update()
  })

  return null
}

// ==============================================================================
// 2. TELEMETRY STATUS BEACON
// ==============================================================================

function Beacon({ item }: { item: FloorMachine }) {
  const light = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.MeshStandardMaterial>(null)

  useFrame(({ clock }) => {
    if (!material.current || !light.current) return
    const t = clock.getElapsedTime()
    let intensity = 1.8
    if (item.beacon === 'blink') {
      intensity = 0.3 + 2.2 * (0.5 + 0.5 * Math.sin(t * 5.4))
    } else if (item.beacon === 'strobe') {
      intensity = Math.sin(t * 16) > 0.2 ? 4.5 : 0.2
    }
    material.current.emissiveIntensity = intensity
    const scale = item.beacon === 'strobe' ? 1 + 0.15 * Math.sin(t * 16) : 1
    light.current.scale.setScalar(scale)
  })

  const color = useMemo(() => new THREE.Color(item.color), [item.color])

  return (
    <group position={[0, 0, 0]}>
      {/* Beacon mast base */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.07, 16]} />
        <meshStandardMaterial color="#1a202c" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Polycarbonate beacon lens */}
      <mesh ref={light} position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.1, 0.11, 0.2, 16]} />
        <meshStandardMaterial
          ref={material}
          color={color}
          emissive={color}
          emissiveIntensity={1.8}
          transparent
          opacity={0.92}
          toneMapped={false}
        />
      </mesh>
      {/* Protective cap */}
      <mesh position={[0, 0.25, 0]}>
        <coneGeometry args={[0.12, 0.06, 16]} />
        <meshStandardMaterial color="#1a202c" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  )
}

// ==============================================================================
// 3. RECOGNIZABLE INDUSTRIAL 3D MACHINE ASSETS WITH LIVE MECHANICAL ANIMATIONS
// ==============================================================================

/**
 * 1. CNC MACHINING CENTER (Machine-001)
 * Authentic dual-tone RAL 7035 enclosure, cast bed, observation window,
 * continuous high-speed spinning spindle collet, X/Z toolpath oscillation,
 * articulated operator HMI touchscreen, and rear electrical cabinet.
 */
function CncMillModel({
  selected,
  operating,
}: {
  selected: boolean
  operating: boolean
}) {
  const spindleRef = useRef<THREE.Group>(null)
  const toolHeadRef = useRef<THREE.Group>(null)
  const accent = selected ? '#f59e0b' : '#38bdf8'

  useFrame(({ clock }, delta) => {
    if (!operating) return
    const t = clock.getElapsedTime()
    if (spindleRef.current) {
      spindleRef.current.rotation.y += delta * 26
    }
    if (toolHeadRef.current) {
      toolHeadRef.current.position.x = Math.sin(t * 1.4) * 0.14
      toolHeadRef.current.position.z = 0.2 + Math.cos(t * 1.8) * 0.1
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Heavy cast-iron machine bed */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.3, 0.5, 2.0]} />
        <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.4} />
      </mesh>
      {/* Leveling feet */}
      {[
        [-1.0, -0.85],
        [1.0, -0.85],
        [-1.0, 0.85],
        [1.0, 0.85],
      ].map(([fx, fz], idx) => (
        <mesh key={idx} position={[fx, 0.04, fz]}>
          <cylinderGeometry args={[0.09, 0.09, 0.08, 12]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
      ))}

      {/* Main enclosure body in RAL 7035 light industrial gray */}
      <mesh position={[0, 1.15, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 1.35, 1.8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.4} roughness={0.35} />
      </mesh>

      {/* Front door frame with safety graphite finish */}
      <mesh position={[0, 1.15, 0.86]}>
        <boxGeometry args={[1.65, 1.25, 0.04]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Observation safety window */}
      <mesh position={[0, 1.22, 0.88]}>
        <boxGeometry args={[1.35, 0.85, 0.03]} />
        <meshStandardMaterial color="#0f172a" transparent opacity={0.55} roughness={0.1} metalness={0.85} />
      </mesh>

      {/* Stainless door grab handle */}
      <mesh position={[0.62, 1.18, 0.92]}>
        <boxGeometry args={[0.04, 0.38, 0.04]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Upper angled roof shroud with exhaust louvers */}
      <mesh position={[0, 1.95, -0.1]} castShadow>
        <boxGeometry args={[2.0, 0.28, 1.6]} />
        <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.3} />
      </mesh>
      {/* Exhaust ventilation vent */}
      <mesh position={[0, 2.14, -0.15]}>
        <cylinderGeometry args={[0.22, 0.26, 0.16, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Interior Milling Chamber Table */}
      <mesh position={[0, 0.58, 0.15]}>
        <boxGeometry args={[1.4, 0.14, 0.9]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Workpiece billet on table */}
      <mesh position={[0, 0.72, 0.15]}>
        <boxGeometry args={[0.5, 0.16, 0.35]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Articulated Milling Head Assembly */}
      <group ref={toolHeadRef} position={[0, 1.45, 0.2]}>
        {/* Z-Axis Motor & Carriage */}
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.42, 0.35, 0.38]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Continuous High-Speed Spinning Spindle Collet & Cutter Bit */}
        <group ref={spindleRef} position={[0, -0.12, 0]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.09, 0.28, 16]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
          </mesh>
          <mesh position={[0, -0.18, 0]}>
            <cylinderGeometry args={[0.04, 0.03, 0.16, 12]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.98} roughness={0.05} />
          </mesh>
        </group>
      </group>

      {/* Operator Touchscreen HMI Control Pendant on swivel arm */}
      <group position={[1.32, 1.35, 0.6]}>
        <mesh>
          <boxGeometry args={[0.08, 0.48, 0.4]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0.045, 0, 0]}>
          <planeGeometry args={[0.34, 0.36]} />
          <meshBasicMaterial color={accent} />
        </mesh>
        {/* Emergency Stop Button */}
        <mesh position={[0.045, -0.18, 0.12]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 0.02, 12]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      </group>
      {/* Pendant swivel arm */}
      <mesh position={[1.2, 1.1, 0.4]}>
        <cylinderGeometry args={[0.035, 0.035, 0.6, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Rear High-Voltage Electrical Cabinet */}
      <mesh position={[0, 1.1, -1.02]}>
        <boxGeometry args={[1.7, 1.2, 0.24]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Hazard Warning Stripe on rear cabinet */}
      <mesh position={[0, 1.55, -0.89]}>
        <boxGeometry args={[0.45, 0.08, 0.01]} />
        <meshBasicMaterial color="#f59e0b" />
      </mesh>
    </group>
  )
}

/**
 * 2. HEAVY-DUTY INDUSTRIAL LATHE & MILL (Machine-002)
 * Elongated slanted bed, ground precision guideways, rotating 3-jaw chuck
 * holding cylindrical alloy billet, 12-station tool turret, tailstock quill,
 * and operator splash guard.
 */
function LatheModel({
  selected,
  operating,
}: {
  selected: boolean
  operating: boolean
}) {
  const chuckGroup = useRef<THREE.Group>(null)
  const accent = selected ? '#f59e0b' : '#38bdf8'

  useFrame((_, delta) => {
    if (!operating) return
    if (chuckGroup.current) {
      chuckGroup.current.rotation.x += delta * 18
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Slanted lathe bed & chip collection trough */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.7, 0.6, 1.5]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Precision Ground Hardened Steel Guideways */}
      <mesh position={[0.2, 0.62, 0.15]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1.9, 0.05, 0.12]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
      </mesh>
      <mesh position={[0.2, 0.62, -0.25]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1.9, 0.05, 0.12]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
      </mesh>

      {/* Headstock Gearbox Casing (Left) in Industrial Blue-Slate */}
      <mesh position={[-0.95, 0.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.85, 1.4]} />
        <meshStandardMaterial color="#1e40af" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Spindle speed digital tachometer readout */}
      <mesh position={[-0.95, 1.25, 0.71]}>
        <planeGeometry args={[0.24, 0.1]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>

      {/* Continuous Rotating 3-Jaw Chuck & Workpiece Billet */}
      <group position={[-0.45, 0.95, 0]}>
        <group ref={chuckGroup} rotation={[0, 0, 0]}>
          {/* Chuck body */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.38, 0.38, 0.22, 24]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.92} roughness={0.15} />
          </mesh>
          {/* 3 Hardened Master Chuck Jaws */}
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
            <mesh
              key={i}
              position={[0.11, Math.sin(angle) * 0.22, Math.cos(angle) * 0.22]}
              rotation={[angle, 0, 0]}
            >
              <boxGeometry args={[0.06, 0.1, 0.08]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.1} />
            </mesh>
          ))}
          {/* Rotating Alloy Steel Billet clamped in chuck */}
          <mesh position={[0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.14, 0.14, 0.95, 20]} />
            <meshStandardMaterial color="#f1f5f9" metalness={0.96} roughness={0.1} />
          </mesh>
        </group>
      </group>

      {/* 12-Station Servo Tool Turret (Center Carriage) */}
      <group position={[0.15, 0.92, -0.05]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.26, 0.26, 0.2, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Tool Holder with Gold Carbide Insert */}
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[0.12, 0.16, 0.12]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* Tailstock Assembly with Revolving Center Quill (Right) */}
      <mesh position={[0.95, 0.85, 0]} castShadow>
        <boxGeometry args={[0.55, 0.65, 0.9]} />
        <meshStandardMaterial color="#1e40af" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Extended Tailstock Quill */}
      <mesh position={[0.62, 0.95, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.35, 16]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
      </mesh>
      {/* 60-degree Live Center Tip */}
      <mesh position={[0.42, 0.95, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.07, 0.12, 16]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.98} roughness={0.05} />
      </mesh>

      {/* Front sliding splash guard with polycarbonate window */}
      <mesh position={[0.05, 1.15, 0.68]}>
        <boxGeometry args={[1.5, 0.75, 0.06]} />
        <meshStandardMaterial color="#0f172a" transparent opacity={0.55} roughness={0.1} metalness={0.9} />
      </mesh>
      {/* Splash guard yellow grab handle */}
      <mesh position={[0.7, 1.15, 0.73]}>
        <boxGeometry args={[0.04, 0.3, 0.04]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.6} />
      </mesh>

      {/* CNC Operator Console */}
      <mesh position={[1.25, 1.25, 0.68]}>
        <boxGeometry args={[0.35, 0.45, 0.12]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[1.25, 1.25, 0.75]}>
        <planeGeometry args={[0.28, 0.32]} />
        <meshBasicMaterial color={accent} />
      </mesh>
    </group>
  )
}

/**
 * 3. 6-AXIS ROBOTIC WELDING CELL (Machine-003)
 * Articulating robot arm in industrial robot orange (KUKA/Fanuc style),
 * rotating waist, articulating shoulder and elbow, welding torch with copper tip,
 * live welding arc glow, welding table with clamped workpiece, and perimeter safety guardrails.
 */
function RoboticCellModel({
  selected: _selected,
  operating,
}: {
  selected: boolean
  operating: boolean
}) {
  const waistRef = useRef<THREE.Group>(null)
  const shoulderRef = useRef<THREE.Group>(null)
  const elbowRef = useRef<THREE.Group>(null)
  const arcLightRef = useRef<THREE.PointLight>(null)

  const armColor = '#ea580c' // Industrial robot orange

  useFrame(({ clock }) => {
    if (!operating) {
      if (arcLightRef.current) arcLightRef.current.intensity = 0
      return
    }
    const t = clock.getElapsedTime()
    // Smooth continuous robotic welding motion
    if (waistRef.current) {
      waistRef.current.rotation.y = Math.sin(t * 1.1) * 0.38
    }
    if (shoulderRef.current) {
      shoulderRef.current.rotation.z = Math.sin(t * 1.1) * 0.15
    }
    if (elbowRef.current) {
      elbowRef.current.rotation.z = -Math.cos(t * 1.1) * 0.22
    }
    // Welding arc tip flickering glow
    if (arcLightRef.current) {
      arcLightRef.current.intensity = 1.0 + Math.random() * 2.2
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Robot Base Pedestal */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.52, 0.4, 20]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Articulating Robot Arm Assembly */}
      <group ref={waistRef} position={[0, 0.4, 0]}>
        {/* Rotating Waist Axis 1 */}
        <mesh position={[0, 0.14, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.36, 0.28, 20]} />
          <meshStandardMaterial color={armColor} metalness={0.4} roughness={0.4} />
        </mesh>

        {/* Shoulder Joint Axis 2 */}
        <group ref={shoulderRef} position={[0, 0.35, -0.05]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.35, 16]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Lower Arm Link */}
          <mesh position={[0, 0.5, 0.2]} rotation={[0.4, 0, 0]} castShadow>
            <boxGeometry args={[0.26, 0.9, 0.22]} />
            <meshStandardMaterial color={armColor} metalness={0.4} roughness={0.4} />
          </mesh>

          {/* Elbow Joint Axis 3 */}
          <group ref={elbowRef} position={[0, 0.88, 0.38]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.18, 0.18, 0.3, 16]} />
              <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* Upper Forearm Link */}
            <mesh position={[0, 0.16, 0.45]} rotation={[-0.7, 0, 0]} castShadow>
              <boxGeometry args={[0.2, 0.85, 0.2]} />
              <meshStandardMaterial color={armColor} metalness={0.4} roughness={0.4} />
            </mesh>
            {/* 3-Axis Wrist & Welding Torch */}
            <group position={[0, -0.12, 0.82]} rotation={[0.6, 0, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.08, 0.08, 0.25, 16]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
              </mesh>
              {/* Copper welding gas nozzle */}
              <mesh position={[0, -0.16, 0.08]} rotation={[0.4, 0, 0]}>
                <coneGeometry args={[0.045, 0.18, 12]} />
                <meshStandardMaterial color="#f97316" metalness={0.85} roughness={0.2} />
              </mesh>
              {/* Live Welding Arc Light */}
              <pointLight
                ref={arcLightRef}
                position={[0, -0.26, 0.12]}
                color="#67e8f9"
                intensity={0}
                distance={3.5}
                decay={2}
              />
            </group>
          </group>
        </group>
      </group>

      {/* Welding worktable fixture in front */}
      <mesh position={[0, 0.45, 1.25]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.7, 0.75]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Clamped structural steel fabrication workpiece */}
      <mesh position={[0, 0.84, 1.25]}>
        <boxGeometry args={[0.55, 0.12, 0.4]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Toggle clamp */}
      <mesh position={[0.22, 0.94, 1.25]}>
        <boxGeometry args={[0.06, 0.12, 0.08]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>

      {/* Safety Perimeter Enclosure with Yellow Posts and Guardrails */}
      {[
        [-1.25, -1.1],
        [1.25, -1.1],
        [-1.25, 1.6],
        [1.25, 1.6],
      ].map(([px, pz], idx) => (
        <group key={idx} position={[px, 0.65, pz]}>
          <mesh>
            <cylinderGeometry args={[0.045, 0.045, 1.3, 12]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.68, 0]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshStandardMaterial color="#1a202c" />
          </mesh>
        </group>
      ))}
      {/* Upper and lower safety guardrails */}
      <mesh position={[0, 1.15, -1.1]}>
        <boxGeometry args={[2.5, 0.04, 0.04]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      <mesh position={[0, 0.55, -1.1]}>
        <boxGeometry args={[2.5, 0.04, 0.04]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      <mesh position={[-1.25, 1.15, 0.25]}>
        <boxGeometry args={[0.04, 0.04, 2.7]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      <mesh position={[-1.25, 0.55, 0.25]}>
        <boxGeometry args={[0.04, 0.04, 2.7]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      <mesh position={[1.25, 1.15, 0.25]}>
        <boxGeometry args={[0.04, 0.04, 2.7]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
      <mesh position={[1.25, 0.55, 0.25]}>
        <boxGeometry args={[0.04, 0.04, 2.7]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
    </group>
  )
}

/**
 * 4. ROTARY SCREW AIR COMPRESSOR (Compressor-001)
 * Sound-dampened cabinet with live spinning cooling fan, horizontal compressed air
 * receiver pressure vessel in Safety Blue, analog Bourdon dial gauge, and relief manifold.
 */
function CompressorModel({
  selected: _selected,
  operating,
}: {
  selected: boolean
  operating: boolean
}) {
  const fanRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!operating) return
    if (fanRef.current) {
      fanRef.current.rotation.y += delta * 24
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Compressor Acoustic Enclosure Cabinet */}
      <mesh position={[-0.5, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 1.3, 1.4]} />
        <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.4} />
      </mesh>
      {/* Louvered cooling grilles */}
      {[-0.2, 0, 0.2, 0.4].map((ly, i) => (
        <mesh key={i} position={[-0.5, 0.75 + ly, 0.71]}>
          <boxGeometry args={[0.85, 0.04, 0.02]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      ))}

      {/* Top Cooling Fan Housing with Live Spinning Multi-Blade Fan */}
      <group position={[-0.5, 1.42, 0]}>
        <mesh>
          <cylinderGeometry args={[0.32, 0.32, 0.06, 20]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        {/* Spinning fan blades */}
        <group ref={fanRef} position={[0, 0.04, 0]}>
          {[0, 1, 2, 3].map((idx) => (
            <mesh key={idx} rotation={[0, (idx * Math.PI) / 2, 0.2]}>
              <boxGeometry args={[0.26, 0.015, 0.06]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.9} />
            </mesh>
          ))}
        </group>
      </group>

      {/* HORIZONTAL COMPRESSED AIR RECEIVER TANK (Safety Blue) */}
      <group position={[0.7, 0.75, 0]}>
        {/* Main cylindrical pressure cylinder */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 1.7, 24]} />
          <meshStandardMaterial color="#0284c7" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Hemispherical dished end caps */}
        <mesh position={[0, 0, 0.85]}>
          <sphereGeometry args={[0.42, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#0284c7" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, -0.85]} rotation={[Math.PI, 0, 0]}>
          <sphereGeometry args={[0.42, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#0284c7" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Tank saddle mounting supports */}
        <mesh position={[0, -0.55, 0.5]}>
          <boxGeometry args={[0.5, 0.4, 0.16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.55, -0.5]}>
          <boxGeometry args={[0.5, 0.4, 0.16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Top Safety Relief Valve (Brass) */}
        <mesh position={[0, 0.52, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.25, 12]} />
          <meshStandardMaterial color="#eab308" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Analog Dial Pressure Gauge */}
        <mesh position={[0, 0.68, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.06, 16]} />
          <meshStandardMaterial color="#f8fafc" metalness={0.5} roughness={0.2} />
        </mesh>
      </group>

      {/* High-pressure connecting manifold pipe */}
      <mesh position={[0.1, 1.15, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.7, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  )
}

/**
 * 5. CENTRIFUGAL PUMP (Pump-001)
 * Steel channel base skid, industrial green volute casing, suction and discharge pipes,
 * live spinning shaft coupling, and TEFC motor with spinning cooling fan.
 */
function PumpModel({
  selected: _selected,
  operating,
}: {
  selected: boolean
  operating: boolean
}) {
  const couplingRef = useRef<THREE.Group>(null)
  const motorFanRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!operating) return
    if (couplingRef.current) {
      couplingRef.current.rotation.x += delta * 22
    }
    if (motorFanRef.current) {
      motorFanRef.current.rotation.x += delta * 22
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Heavy Structural Steel Channel Baseplate */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 0.2, 0.9]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* CENTRIFUGAL PUMP VOLUTE CASING (Industrial Green) */}
      <mesh position={[-0.45, 0.52, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.38, 0.38, 0.28, 24]} />
        <meshStandardMaterial color="#15803d" metalness={0.65} roughness={0.35} />
      </mesh>
      {/* Axial suction intake flange (Front) */}
      <mesh position={[-0.45, 0.52, 0.24]}>
        <cylinderGeometry args={[0.14, 0.14, 0.24, 16]} />
        <meshStandardMaterial color="#15803d" metalness={0.65} roughness={0.35} />
      </mesh>
      <mesh position={[-0.45, 0.52, 0.38]}>
        <cylinderGeometry args={[0.22, 0.22, 0.06, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Suction Handwheel Isolation Valve */}
      <mesh position={[-0.45, 0.72, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.08, 0.018, 8, 16]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>

      {/* Vertical tangential discharge flange (Top) */}
      <mesh position={[-0.28, 0.85, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.35, 16]} />
        <meshStandardMaterial color="#15803d" metalness={0.65} roughness={0.35} />
      </mesh>
      <mesh position={[-0.28, 1.04, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.05, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Discharge pressure gauge */}
      <mesh position={[-0.28, 1.18, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.04, 16]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>

      {/* Shaft Bearing Housing */}
      <mesh position={[0, 0.52, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.38, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.3} />
      </mesh>

      {/* Live Spinning Flexible Shaft Coupling */}
      <group ref={couplingRef} position={[0.18, 0.52, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.14, 16]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
        </mesh>
      </group>

      {/* Flanged Electric Drive Motor */}
      <mesh position={[0.55, 0.52, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.72, 20]} />
        <meshStandardMaterial color="#0f766e" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Motor Terminal Conduit Box */}
      <mesh position={[0.55, 0.84, 0]}>
        <boxGeometry args={[0.18, 0.14, 0.16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Motor Rear Cooling Fan Cowl with Spinning Fan Blades */}
      <group position={[0.95, 0.52, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.27, 0.27, 0.12, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        <group ref={motorFanRef} position={[0.04, 0, 0]}>
          {[0, 1, 2].map((idx) => (
            <mesh key={idx} rotation={[(idx * Math.PI) / 3, 0, 0]}>
              <boxGeometry args={[0.02, 0.22, 0.04]} />
              <meshStandardMaterial color="#94a3b8" />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

/**
 * 6. 75 kW 3-PHASE INDUCTION MOTOR (Motor-001)
 * Siemens industrial blue finish, deep radiating cooling fins, live spinning output
 * drive shaft with keyway, spinning rear cooling fan, top terminal box, and forged eyebolt.
 */
function InductionMotorModel({
  selected: _selected,
  operating,
}: {
  selected: boolean
  operating: boolean
}) {
  const shaftRef = useRef<THREE.Group>(null)
  const fanRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!operating) return
    if (shaftRef.current) {
      shaftRef.current.rotation.x += delta * 24
    }
    if (fanRef.current) {
      fanRef.current.rotation.x += delta * 24
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Cast Iron Foundation Mounting Feet */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.18, 1.2]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Main Ribbed Stator Housing Cylinder (Siemens Industrial Blue) */}
      <mesh position={[0, 0.62, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.45, 0.45, 1.05, 24]} />
        <meshStandardMaterial color="#1d4ed8" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Cooling Fins radiating around stator */}
      {[0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75].map((angle, idx) => (
        <mesh key={idx} position={[0, 0.62, 0]} rotation={[angle * Math.PI, 0, 0]}>
          <boxGeometry args={[0.95, 0.98, 0.03]} />
          <meshStandardMaterial color="#1e40af" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}

      {/* Drive End (DE) & Non-Drive End (NDE) Bearing End-Shields */}
      <mesh position={[-0.56, 0.62, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.42, 0.42, 0.12, 20]} />
        <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0.56, 0.62, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.42, 0.42, 0.12, 20]} />
        <meshStandardMaterial color="#0f172a" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Continuous Live Spinning Drive Shaft with Keyway (Output Left) */}
      <group position={[-0.8, 0.62, 0]}>
        <group ref={shaftRef}>
          {/* Main shaft */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.11, 0.11, 0.4, 16]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.98} roughness={0.08} />
          </mesh>
          {/* Shaft keyway / collar notch */}
          <mesh position={[-0.05, 0.11, 0]}>
            <boxGeometry args={[0.18, 0.03, 0.03]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.95} />
          </mesh>
        </group>
      </group>

      {/* Rear Fan Cowl Housing & Live Spinning Fan (Right) */}
      <group position={[0.66, 0.62, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.41, 0.41, 0.14, 20]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        {/* Spinning internal cooling fan */}
        <group ref={fanRef} position={[0.06, 0, 0]}>
          {[0, 1, 2, 3].map((idx) => (
            <mesh key={idx} rotation={[(idx * Math.PI) / 4, 0, 0]}>
              <boxGeometry args={[0.03, 0.36, 0.06]} />
              <meshStandardMaterial color="#94a3b8" />
            </mesh>
          ))}
        </group>
      </group>

      {/* Electrical Terminal Junction Box on Top */}
      <mesh position={[0, 1.15, 0]}>
        <boxGeometry args={[0.34, 0.22, 0.3]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Top Forged Lifting Eyebolt */}
      <mesh position={[0, 1.34, 0]}>
        <torusGeometry args={[0.07, 0.022, 10, 20]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} />
      </mesh>
    </group>
  )
}

// ==============================================================================
// 4. FLOATING INDUSTRIAL MACHINE LABEL (BILLBOARD SPRITE)
// ==============================================================================

function MachineLabel({ item, selected }: { item: FloorMachine; selected: boolean }) {
  const spriteTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 190
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Background Card
    ctx.fillStyle = selected ? 'rgba(15, 23, 42, 0.98)' : 'rgba(15, 23, 42, 0.90)'
    ctx.strokeStyle = selected ? '#f59e0b' : item.color
    ctx.lineWidth = selected ? 8 : 5

    // Rounded rectangle
    const r = 20
    const x = 5
    const y = 5
    const w = 512 - 10
    const h = 190 - 10
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Status Dot
    ctx.fillStyle = item.color
    ctx.beginPath()
    ctx.arc(38, 54, 14, 0, Math.PI * 2)
    ctx.fill()

    // Machine ID (e.g. Machine-001)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 36px Inter, system-ui, sans-serif'
    ctx.fillText(item.machine.machine_id, 68, 66)

    // Status Pill on right
    ctx.fillStyle = item.color
    ctx.font = 'bold 22px Inter, system-ui, sans-serif'
    const statusText = item.status.toUpperCase()
    const textWidth = ctx.measureText(statusText).width
    ctx.fillText(statusText, 512 - textWidth - 28, 64)

    // Divider Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(22, 94)
    ctx.lineTo(512 - 22, 94)
    ctx.stroke()

    // Machine Full Name
    ctx.fillStyle = '#93c5fd'
    ctx.font = '600 26px Inter, system-ui, sans-serif'
    const nameText =
      item.machine.name.length > 28 ? item.machine.name.substring(0, 26) + '…' : item.machine.name
    ctx.fillText(nameText, 24, 134)

    // Subtitle Category & Bay
    ctx.fillStyle = '#94a3b8'
    ctx.font = '500 20px Inter, system-ui, sans-serif'
    ctx.fillText(
      `${item.bay.toUpperCase()} · ${item.machine.category.replace('_', ' ')}`,
      24,
      166
    )

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }, [item.machine.machine_id, item.machine.name, item.machine.category, item.bay, item.status, item.color, selected])

  if (!spriteTexture) return null

  return (
    <sprite position={[0, 2.7, 0]} scale={[2.6, 0.96, 1]}>
      <spriteMaterial map={spriteTexture} depthTest={false} transparent />
    </sprite>
  )
}

// ==============================================================================
// 5. MASTER MACHINE UNIT WRAPPER
// ==============================================================================

function MachineUnit({
  item,
  position,
  selected,
  onSelect,
  onHover,
}: {
  item: FloorMachine
  position: [number, number, number]
  selected: boolean
  onSelect: (id: string, worldPos: [number, number, number]) => void
  onHover: (item: FloorMachine | null) => void
}) {
  const [hovered, setHovered] = useState(false)
  const machineRef = useRef<THREE.Group>(null)

  const isShutdown = item.status.toUpperCase() === 'SHUTDOWN'
  const isCritical =
    !isShutdown &&
    (item.status.toUpperCase() === 'CRITICAL' ||
      item.status.toUpperCase() === 'EMERGENCY' ||
      item.beacon === 'strobe' ||
      item.anomaly >= 80)

  const isWarning =
    !isShutdown &&
    !isCritical &&
    (item.status.toUpperCase() === 'WARNING' ||
      item.beacon === 'blink' ||
      item.anomaly >= 45)

  const isOperating = !isShutdown

  useFrame(({ clock }) => {
    if (!machineRef.current) return
    const t = clock.getElapsedTime()
    if (isCritical) {
      machineRef.current.position.x = Math.sin(t * 54) * 0.03
      machineRef.current.position.z = Math.cos(t * 60) * 0.03
      machineRef.current.position.y = Math.sin(t * 42) * 0.012
    } else if (isWarning) {
      machineRef.current.position.x = Math.sin(t * 20) * 0.01
      machineRef.current.position.z = Math.cos(t * 24) * 0.01
      machineRef.current.position.y = 0
    } else {
      machineRef.current.position.set(0, 0, 0)
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect(item.machine.machine_id, position)
  }

  const category = item.machine.category
  const chevronColor = isShutdown ? '#64748b' : isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#38bdf8'

  return (
    <group position={position}>
      {/* FLOATING HIGH-VISIBILITY INDUSTRIAL MACHINE LABEL */}
      <MachineLabel item={item} selected={selected} />

      {/* CONCRETE MOUNTING FOUNDATION PLINTH */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <boxGeometry args={[3.2, 0.12, 2.8]} />
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.125, 0]} receiveShadow>
        <boxGeometry args={[3.0, 0.02, 2.6]} />
        <meshStandardMaterial color="#334155" roughness={0.8} />
      </mesh>

      {/* OSHA HAZARD CAUTION BORDER AROUND PLINTH */}
      <mesh position={[0, 0.13, 1.38]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.0, 0.12]} />
        <meshBasicMaterial color={chevronColor} />
      </mesh>
      <mesh position={[0, 0.13, -1.38]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.0, 0.12]} />
        <meshBasicMaterial color={chevronColor} />
      </mesh>
      <mesh position={[-1.56, 0.13, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[2.8, 0.12]} />
        <meshBasicMaterial color={chevronColor} />
      </mesh>
      <mesh position={[1.56, 0.13, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[2.8, 0.12]} />
        <meshBasicMaterial color={chevronColor} />
      </mesh>

      {/* RESTRAINED CRITICAL ALERT INDICATOR */}
      {isCritical && (
        <group position={[0, 0.15, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.85, 2.15, 36]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.65} side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[0, 1.8, 0]} intensity={2.2} color="#ef4444" distance={5} />
        </group>
      )}

      {/* SAFETY COLLISION BOLLARDS AT CORNERS (Yellow with Black Bands) */}
      {[
        [-1.68, -1.45],
        [1.68, -1.45],
        [-1.68, 1.45],
        [1.68, 1.45],
      ].map(([bx, bz], bi) => (
        <group key={bi} position={[bx, 0.38, bz]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.065, 0.065, 0.76, 12]} />
            <meshStandardMaterial color="#eab308" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.067, 0.067, 0.12, 12]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.067, 0.067, 0.12, 12]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>
      ))}

      {/* INTERACTIVE CLICK & HOVER BOUNDING ENVELOPE */}
      <group
        ref={machineRef}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          onHover(item)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          onHover(null)
          document.body.style.cursor = 'auto'
        }}
      >
        {/* Render category-specific authentic machinery */}
        {category === 'CNC_MILL' && <CncMillModel selected={selected || hovered} operating={isOperating} />}
        {category === 'TURNING_CENTER' && <LatheModel selected={selected || hovered} operating={isOperating} />}
        {category === 'ROBOTIC_CELL' && <RoboticCellModel selected={selected || hovered} operating={isOperating} />}
        {category === 'COMPRESSOR' && <CompressorModel selected={selected || hovered} operating={isOperating} />}
        {category === 'PUMP' && <PumpModel selected={selected || hovered} operating={isOperating} />}
        {category === 'MOTOR' && <InductionMotorModel selected={selected || hovered} operating={isOperating} />}
        {!['CNC_MILL', 'TURNING_CENTER', 'ROBOTIC_CELL', 'COMPRESSOR', 'PUMP', 'MOTOR'].includes(category) && (
          <CncMillModel selected={selected || hovered} operating={isOperating} />
        )}
      </group>

      {/* INDUSTRIAL BEACON MAST & TELEMETRY STATUS LIGHT */}
      <group position={[1.15, 1.75, -0.9]}>
        <mesh position={[0, -0.35, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.7, 8]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
        </mesh>
        <Beacon item={item} />
      </group>

      {/* SELECTION HALO / FOCUS RING ON FLOOR */}
      {(selected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]}>
          <ringGeometry args={[1.75, 1.95, 36]} />
          <meshBasicMaterial
            color={selected ? '#f59e0b' : '#38bdf8'}
            transparent
            opacity={selected ? 0.85 : 0.45}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

// ==============================================================================
// 6. FACTORY ARCHITECTURE & SURROUNDINGS
// ==============================================================================

function OverheadGantry() {
  return (
    <group position={[0, 14, 0]}>
      <mesh position={[-8.5, 0, 0]}>
        <boxGeometry args={[0.25, 0.45, 30]} />
        <meshStandardMaterial color="#eab308" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[8.5, 0, 0]}>
        <boxGeometry args={[0.25, 0.45, 30]} />
        <meshStandardMaterial color="#eab308" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  )
}

function StructuralColumns() {
  const columnPositions: [number, number, number][] = [
    [-15, 4.5, -11],
    [15, 4.5, -11],
    [-15, 4.5, 11],
    [15, 4.5, 11],
  ]

  return (
    <group>
      {columnPositions.map(([cx, cy, cz], idx) => (
        <group key={idx} position={[cx, cy, cz]}>
          <mesh castShadow>
            <boxGeometry args={[0.6, 9.0, 0.6]} />
            <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[0, -3.4, 0]}>
            <boxGeometry args={[0.78, 2.2, 0.78]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, -2.9, 0]}>
            <boxGeometry args={[0.8, 0.25, 0.8]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function GhostFlowPiping({ valve }: { valve: number }) {
  const particleCount = 28
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      offset: i / particleCount,
      branch: i % 2 === 0 ? 'main' : 'cross',
    }))
  }, [])

  const particleMeshes = useRef<(THREE.Mesh | null)[]>([])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const speed = (valve / 100) * 1.8

    particles.forEach((p, idx) => {
      const mesh = particleMeshes.current[idx]
      if (!mesh) return

      const progress = (p.offset + t * speed * 0.25) % 1.0

      if (p.branch === 'main') {
        const z = -7.5 + progress * 15.0
        mesh.position.set(-2.4, 0.28, z)
      } else {
        const x = -8.0 + progress * 16.0
        mesh.position.set(x, 0.28, 0)
      }

      mesh.scale.setScalar(valve === 0 ? 0.001 : 1.0)
    })
  })

  return (
    <group>
      <mesh position={[-2.4, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 15.6, 16]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          transmission={0.82}
          opacity={0.38}
          transparent
          roughness={0.08}
          ior={1.45}
        />
      </mesh>

      <mesh position={[0, 0.28, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 16.4, 16]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          transmission={0.82}
          opacity={0.38}
          transparent
          roughness={0.08}
          ior={1.45}
        />
      </mesh>

      <mesh position={[-2.4, 0.28, 0]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color="#0284c7" metalness={0.9} roughness={0.2} />
      </mesh>

      <group>
        {particles.map((_, i) => (
          <mesh
            key={i}
            ref={(el) => {
              particleMeshes.current[i] = el
            }}
          >
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.78} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function ForcefieldDome({ active }: { active: boolean }) {
  if (!active) return null

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 4.5, 0]}>
        <cylinderGeometry args={[17.5, 17.5, 9.0, 40, 14, true]} />
        <meshBasicMaterial
          color="#06b6d4"
          wireframe
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[17.3, 17.6, 48]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

function LidarThermalEffects({ viewMode }: { viewMode: 'standard' | 'thermal' | 'lidar' }) {
  const laserPlane = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (viewMode === 'lidar' && laserPlane.current) {
      const t = clock.getElapsedTime()
      laserPlane.current.position.x = Math.sin(t * 1.5) * 14.0
    }
  })

  if (viewMode === 'lidar') {
    return (
      <mesh ref={laserPlane} position={[0, 4.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[26, 9]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.22} side={THREE.DoubleSide} />
      </mesh>
    )
  }

  if (viewMode === 'thermal') {
    return (
      <group>
        {[-8, 0, 8].map((x, i) => (
          <mesh key={`therm-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.04, 0]}>
            <circleGeometry args={[2.4, 24]} />
            <meshBasicMaterial color={i === 1 ? '#ef4444' : '#f97316'} transparent opacity={0.35} />
          </mesh>
        ))}
      </group>
    )
  }

  return null
}

// ==============================================================================
// 7. MASTER FLOOR 3D CANVAS COMPONENT
// ==============================================================================

export default function Floor3D({
  floor,
  onSelect,
  selectedId,
  viewMode = 'standard',
  valve = 85,
  showForcefield = true,
  onHover,
}: {
  floor: FloorMachine[]
  onSelect: (id: string) => void
  selectedId: string | null
  viewMode?: 'standard' | 'thermal' | 'lidar'
  valve?: number
  egressTrigger?: number
  showForcefield?: boolean
  onHover?: (item: FloorMachine | null) => void
}) {
  const maxSlot = Math.max(1, ...floor.map((f) => f.slot + 1))
  const theme = useSettingsStore((s) => s.theme)
  const isLight = theme === 'light'

  // Map machineId to its world coordinates
  const machinePositions = useMemo(() => {
    const map = new Map<string, [number, number, number]>()
    floor.forEach((item) => {
      const row = BAYS.indexOf(item.bay)
      const x = (item.slot - (maxSlot - 1) / 2) * SLOT_SPACING
      const z = (row - (BAYS.length - 1) / 2) * BAY_SPACING
      map.set(item.machine.machine_id, [x, 0, z])
    })
    return map
  }, [floor, maxSlot])

  const selectedPosition = useMemo(() => {
    if (!selectedId) return null
    return machinePositions.get(selectedId) ?? null
  }, [selectedId, machinePositions])

  const handleMachineSelect = (id: string, worldPos: [number, number, number]) => {
    void worldPos
    onSelect(id)
  }

  // Palette switches based on View Mode and Theme
  const bgColor =
    viewMode === 'thermal'
      ? '#070414'
      : viewMode === 'lidar'
        ? '#010409'
        : isLight
          ? '#e2e8f0'
          : '#0f172a'
  const fogColor = bgColor
  const gridColor =
    viewMode === 'thermal'
      ? '#4c1d95'
      : viewMode === 'lidar'
        ? '#06b6d4'
        : isLight
          ? '#94a3b8'
          : '#334155'
  const floorMatColor =
    viewMode === 'thermal'
      ? '#180e29'
      : viewMode === 'lidar'
        ? '#020617'
        : isLight
          ? '#cbd5e1'
          : '#1e293b'

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 13, 19], fov: 44 }}
      className="touch-none"
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={[bgColor]} />
      <fog attach="fog" args={[fogColor, 32, 60]} />

      {/* OrbitControls with smooth focus transitions */}
      <CameraController focusPosition={selectedPosition} />

      {/* SCENE LIGHTING */}
      {viewMode === 'standard' && (
        <>
          <ambientLight intensity={isLight ? 2.0 : 1.4} color="#ffffff" />
          <directionalLight
            position={[10, 22, 12]}
            intensity={isLight ? 2.2 : 1.9}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-near={0.5}
            shadow-camera-far={50}
            shadow-camera-left={-20}
            shadow-camera-right={20}
            shadow-camera-top={20}
            shadow-camera-bottom={-20}
          />
          <pointLight position={[-12, 10, -8]} intensity={0.9} color="#38bdf8" />
          <pointLight position={[12, 10, 8]} intensity={0.9} color="#f59e0b" />
        </>
      )}

      {viewMode === 'thermal' && (
        <>
          <ambientLight intensity={0.8} color="#4338ca" />
          <directionalLight position={[10, 20, 10]} intensity={2.6} color="#fb923c" />
          <pointLight position={[0, 6, 0]} intensity={2.2} color="#f43f5e" />
        </>
      )}

      {viewMode === 'lidar' && (
        <>
          <ambientLight intensity={0.6} color="#042f2e" />
          <directionalLight position={[0, 20, 0]} intensity={1.6} color="#06b6d4" />
          <pointLight position={[0, 5, 0]} intensity={2.0} color="#22c55e" />
        </>
      )}

      {/* HIGH-CONTRAST INDUSTRIAL FLOOR WITH EPOXY FINISH */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[38, 28]} />
        <meshStandardMaterial
          color={floorMatColor}
          roughness={viewMode === 'lidar' ? 0.2 : 0.65}
          metalness={viewMode === 'lidar' ? 0.9 : 0.25}
          wireframe={viewMode === 'lidar'}
        />
      </mesh>

      {/* FACTORY EXPANSION GRID SEAMS */}
      <gridHelper args={[38, 19, gridColor, '#1e293b']} position={[0, 0.005, 0]} />

      {/* GREEN PEDESTRIAN SAFETY AISLE (Walkway between Bays) */}
      {viewMode !== 'lidar' && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
            <planeGeometry args={[34, 1.4]} />
            <meshStandardMaterial
              color={viewMode === 'thermal' ? '#312e81' : '#065f46'}
              roughness={0.7}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.7]}>
            <planeGeometry args={[34, 0.08]} />
            <meshBasicMaterial color={viewMode === 'thermal' ? '#fbbf24' : '#f59e0b'} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -0.7]}>
            <planeGeometry args={[34, 0.08]} />
            <meshBasicMaterial color={viewMode === 'thermal' ? '#fbbf24' : '#f59e0b'} />
          </mesh>
        </>
      )}

      {/* OVERHEAD STRUCTURAL ELEMENTS */}
      <OverheadGantry />
      <StructuralColumns />

      {/* GHOST FLOW PIPING */}
      <GhostFlowPiping valve={valve} />

      {/* PERIMETER AIR-GAP DOME */}
      <ForcefieldDome active={showForcefield} />

      {/* LIDAR / THERMAL OVERLAYS */}
      <LidarThermalEffects viewMode={viewMode} />

      {/* RECOGNIZABLE INDUSTRIAL MACHINERY ASSETS */}
      {floor.map((item) => {
        const pos = machinePositions.get(item.machine.machine_id) ?? [0, 0, 0]
        return (
          <MachineUnit
            key={item.machine.machine_id}
            item={item}
            position={pos}
            selected={selectedId === item.machine.machine_id}
            onSelect={handleMachineSelect}
            onHover={(hItem) => onHover?.(hItem)}
          />
        )
      })}
    </Canvas>
  )
}
