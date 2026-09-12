import { useState, useMemo, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Link } from 'react-router-dom'
import {
  Boxes,
  RotateCcw,
  Sparkles,
  Zap,
  Activity,
  Gauge,
  Workflow,
  AlertTriangle,
} from 'lucide-react'
import { useSound } from '@/hooks/useSound'
import { useAlertStore } from '@/store/alertStore'

// ==============================================================================
// 1. DATA DEFINITIONS & ASSET CATALOG
// ==============================================================================

interface Hotspot {
  tag: string
  title: string
  stress: number
  description: string
  kt: string
}

interface ComponentSpec {
  name: string
  category: 'SHAFT' | 'IMPELLER' | 'BEARING' | 'JOINT'
  modelType: 'shaft' | 'impeller' | 'bearing' | 'joint'
  material: string
  yieldStrength: number
  youngsModulus: number
  poissonsRatio: string
  hotspots: Hotspot[]
}

interface MachineData {
  id: string
  label: string
  shortLabel: string
  components: ComponentSpec[]
}

const MACHINES_DATA: MachineData[] = [
  {
    id: 'Machine-001',
    label: 'Machine-001 High-Precision 5-Axis CNC',
    shortLabel: 'Machine-001 High-Precision 5-A...',
    components: [
      {
        name: '5-Axis Spindle Quill',
        category: 'SHAFT',
        modelType: 'shaft',
        material: '42CrMo4 Alloy Steel',
        yieldStrength: 350,
        youngsModulus: 210,
        poissonsRatio: '0.28 – 0.34',
        hotspots: [
          {
            tag: 'FILLET',
            title: 'Spindle Taper Transition Fillet (R = 2.0 mm)',
            stress: 238,
            description: 'Stepped transition under combined high-speed cutting forces and tool clamping tension.',
            kt: '2.42x',
          },
          {
            tag: 'SHAFT',
            title: 'Drive Spline Keyway Root',
            stress: 195,
            description: 'Torsional shear stress concentration along internal 90° keyway corners.',
            kt: '2.15x',
          },
        ],
      },
      {
        name: 'High-Speed Hybrid Ceramic Bearing',
        category: 'BEARING',
        modelType: 'bearing',
        material: '100Cr6 / Si3N4 Ceramic',
        yieldStrength: 350,
        youngsModulus: 210,
        poissonsRatio: '0.28 – 0.34',
        hotspots: [
          {
            tag: 'BEARING',
            title: 'Raceway Contact Hertzian Zone',
            stress: 312,
            description: 'Point contact elliptical stress field between ceramic balls and steel raceway.',
            kt: '2.65x',
          },
          {
            tag: 'FILLET',
            title: 'Shoulder Fillet Radius',
            stress: 142,
            description: 'Inner ring thrust shoulder fillet under axial pre-load.',
            kt: '1.7x',
          },
        ],
      },
    ],
  },
  {
    id: 'Machine-002',
    label: 'Machine-002 Heavy Duty Industrial Lathe',
    shortLabel: 'Machine-002 Heavy Duty Industr...',
    components: [
      {
        name: 'Main Spindle Bearing B-201',
        category: 'BEARING',
        modelType: 'bearing',
        material: '100Cr6 / Si3N4 Ceramic',
        yieldStrength: 350,
        youngsModulus: 210,
        poissonsRatio: '0.28 – 0.34',
        hotspots: [
          {
            tag: 'BEARING',
            title: 'Inner Raceway Loaded Arc (Hertzian Zone)',
            stress: 349,
            description: 'High-pressure elliptical contact patch between rolling balls and hardened inner ring.',
            kt: '2.5x',
          },
          {
            tag: 'FILLET',
            title: 'Shoulder Fillet Radius',
            stress: 135,
            description: 'Inner ring thrust shoulder fillet under axial pre-load and thermal gradient.',
            kt: '1.65x',
          },
        ],
      },
      {
        name: 'Chuck Clamping Hydraulic Piston',
        category: 'JOINT',
        modelType: 'joint',
        material: '42CrMo4 Alloy Steel',
        yieldStrength: 350,
        youngsModulus: 210,
        poissonsRatio: '0.28 – 0.34',
        hotspots: [
          {
            tag: 'JOINT',
            title: 'Piston Rod Seal Clevis Fillet',
            stress: 218,
            description: 'Tensile bending moment across the hydraulic cylinder rod anchor.',
            kt: '2.1x',
          },
        ],
      },
      {
        name: '12-Station Servo Turret',
        category: 'JOINT',
        modelType: 'joint',
        material: '42CrMo4 Alloy Steel',
        yieldStrength: 350,
        youngsModulus: 210,
        poissonsRatio: '0.28 – 0.34',
        hotspots: [
          {
            tag: 'JOINT',
            title: 'Curvic Coupling Root Teeth',
            stress: 264,
            description: 'Contact shear and tooth bending during rapid tool index locking.',
            kt: '2.35x',
          },
        ],
      },
    ],
  },
  {
    id: 'Machine-003',
    label: 'Machine-003 Robotic Welding Cell',
    shortLabel: 'Machine-003 Robotic Welding Ce...',
    components: [
      {
        name: '6-Axis Articulated Arm',
        category: 'JOINT',
        modelType: 'joint',
        material: '42CrMo4 Alloy Steel',
        yieldStrength: 350,
        youngsModulus: 210,
        poissonsRatio: '0.28 – 0.34',
        hotspots: [
          {
            tag: 'JOINT',
            title: 'Pivot Hinge Clevis Fillet',
            stress: 245,
            description: 'Bending stress concentration at the internal corner of the articulated clevis fork.',
            kt: '2.55x',
          },
          {
            tag: 'FILLET',
            title: 'Transverse Pin Bore Bearing Seat',
            stress: 193,
            description: 'Bearing contact pressure around the dowel pivot pin during acceleration transients.',
            kt: '1.85x',
          },
        ],
      },
      {
        name: 'Water-Cooled MIG Torch',
        category: 'SHAFT',
        modelType: 'shaft',
        material: 'CuCrZr Copper Alloy',
        yieldStrength: 280,
        youngsModulus: 130,
        poissonsRatio: '0.31 – 0.34',
        hotspots: [
          {
            tag: 'SHAFT',
            title: 'Gooseneck Thermal Neck Transition',
            stress: 182,
            description: 'Thermal expansion constraint stress during continuous arc deposition.',
            kt: '1.92x',
          },
        ],
      },
    ],
  },
  {
    id: 'Pump-001',
    label: 'Pump-001 Coolant Circulation',
    shortLabel: 'Pump-001 Coolant Circulatio...',
    components: [
      {
        name: 'Bronze Cast Impeller',
        category: 'IMPELLER',
        modelType: 'impeller',
        material: 'CuSn12 Bronze Cast',
        yieldStrength: 350,
        youngsModulus: 115,
        poissonsRatio: '0.28 – 0.34',
        hotspots: [
          {
            tag: 'IMPELLER',
            title: 'Vane Root Fillet at Hub',
            stress: 258,
            description: 'Peak cantilever bending moment at the root of the backward-curved impeller blade.',
            kt: '2.45x',
          },
          {
            tag: 'SHAFT',
            title: 'Impeller Bore & Key Seat',
            stress: 208,
            description: 'Hoop stress from press-fit and dynamic torque transmission from drive shaft.',
            kt: '1.9x',
          },
        ],
      },
      {
        name: 'Double Mechanical Seal',
        category: 'SHAFT',
        modelType: 'shaft',
        material: 'Silicon Carbide / 316SS',
        yieldStrength: 320,
        youngsModulus: 195,
        poissonsRatio: '0.27 – 0.30',
        hotspots: [
          {
            tag: 'SHAFT',
            title: 'Seal Face Drive Pin Collar',
            stress: 174,
            description: 'Contact shear against anti-rotation drive pin.',
            kt: '1.75x',
          },
        ],
      },
    ],
  },
  {
    id: 'Motor-001',
    label: 'Motor-001 75 kW 3-Phase Induction',
    shortLabel: 'Motor-001 75 kW 3-Phase Indu...',
    components: [
      {
        name: 'Copper Stator Windings',
        category: 'SHAFT',
        modelType: 'shaft',
        material: '42CrMo4 Alloy Steel',
        yieldStrength: 350,
        youngsModulus: 210,
        poissonsRatio: '0.28 – 0.34',
        hotspots: [
          {
            tag: 'FILLET',
            title: 'Shoulder Transition Fillet (R = 2.5 mm)',
            stress: 224,
            description: 'Stepped diameter transition under combined cyclic bending and shaft torsion.',
            kt: '2.55x',
          },
          {
            tag: 'SHAFT',
            title: 'Drive Shaft Keyway Root',
            stress: 193,
            description: 'Torsional shear stress concentration along internal 90° keyway corners.',
            kt: '2.2x',
          },
          {
            tag: 'BEARING',
            title: 'Bearing Journal Seat Fit',
            stress: 168,
            description: 'Interference press-fit contact stress overlaid with alternating bending.',
            kt: '1.75x',
          },
        ],
      },
      {
        name: 'Squirrel Cage Rotor',
        category: 'SHAFT',
        modelType: 'shaft',
        material: '42CrMo4 Alloy Steel',
        yieldStrength: 350,
        youngsModulus: 210,
        poissonsRatio: '0.28 – 0.34',
        hotspots: [
          {
            tag: 'SHAFT',
            title: 'End Ring Brazed Joint Fillet',
            stress: 198,
            description: 'Differential thermal expansion between copper rotor bars and steel core laminations.',
            kt: '2.05x',
          },
        ],
      },
    ],
  },
  {
    id: 'Compressor-001',
    label: 'Compressor-001 Rotary Screw Air Compressor',
    shortLabel: 'Compressor-001 Rotary Screw Air C...',
    components: [
      {
        name: 'Male Helical Rotor',
        category: 'SHAFT',
        modelType: 'shaft',
        material: '42CrMo4 Alloy Steel',
        yieldStrength: 350,
        youngsModulus: 210,
        poissonsRatio: '0.28 – 0.34',
        hotspots: [
          {
            tag: 'SHAFT',
            title: 'Lobe Flank Contact Pitchline',
            stress: 274,
            description: 'Conjugate mesh line contact pressure under discharge compression ratio.',
            kt: '2.38x',
          },
          {
            tag: 'BEARING',
            title: 'Discharge Bearing Journal Collar',
            stress: 204,
            description: 'Heavy axial thrust reaction from compressed gas pressure differential.',
            kt: '1.92x',
          },
        ],
      },
      {
        name: 'Female Helical Rotor',
        category: 'SHAFT',
        modelType: 'shaft',
        material: '42CrMo4 Alloy Steel',
        yieldStrength: 350,
        youngsModulus: 210,
        poissonsRatio: '0.28 – 0.34',
        hotspots: [
          {
            tag: 'SHAFT',
            title: 'Gull-Wing Flank Root Fillet',
            stress: 236,
            description: 'Root bending stress along the 6-lobe helical profile.',
            kt: '2.18x',
          },
        ],
      },
    ],
  },
]

// ==============================================================================
// 2. 3D FINITE ELEMENT CONTINUUM MESHES
// ==============================================================================

interface ModelProps {
  feedRate: number
  spindleRpm: number
  driveTorque: number
  thermalLoad: number
  exaggeration: number
  deformation: boolean
  ghostWire: boolean
  feaGrid: boolean
  hotspots: boolean
  palette: 'rainbow' | 'viridis'
  peakStress: number
  yieldLimit: number
  isCritical: boolean
  isWarning: boolean
  overloadRatio: number
}

/** Visual crack propagation and shear fracture lines across critical concentration zones */
function FractureCrackOverlay({
  position = [0, 0, 0],
  scale = 1,
}: {
  position?: [number, number, number]
  scale?: number
}) {
  const crackRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!crackRef.current) return
    const t = clock.getElapsedTime()
    crackRef.current.scale.setScalar(scale * (1 + 0.12 * Math.sin(t * 18)))
  })

  return (
    <group ref={crackRef} position={position}>
      {/* Primary Jagged Fracture Fissure */}
      <mesh rotation={[Math.PI / 2, 0.2, 0]}>
        <ringGeometry args={[0.76, 0.84, 18, 1, 0, Math.PI * 1.85]} />
        <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0.2, 0]}>
        <ringGeometry args={[0.78, 0.81, 18, 1, 0, Math.PI * 1.85]} />
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
      {/* Secondary Branch Cracks */}
      <mesh position={[0.45, 0.12, 0.45]} rotation={[0.4, 0.6, 0]}>
        <boxGeometry args={[0.04, 0.38, 0.04]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[-0.45, -0.1, 0.4]} rotation={[-0.3, -0.5, 0]}>
        <boxGeometry args={[0.035, 0.32, 0.035]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
    </group>
  )
}

/** 3D Stepped Shaft Model (Motor-001 / Machining Spindle) */
function ShaftMesh({
  exaggeration,
  deformation,
  ghostWire,
  feaGrid,
  hotspots,
  palette,
  peakStress,
  isCritical,
  isWarning,
  overloadRatio,
}: ModelProps) {
  const meshRef = useRef<THREE.Group>(null)
  const defScale = deformation ? (exaggeration / 35) * (peakStress / 350) * 0.08 : 0

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime()
    // Violent high-frequency mechanical vibration tremor when critical threshold exceeded
    const shudderX = isCritical ? Math.sin(t * 58) * (0.02 + overloadRatio * 0.035) : 0
    const shudderY = isCritical ? Math.cos(t * 54) * (0.02 + overloadRatio * 0.035) : 0
    const shudderZ = isCritical ? Math.sin(t * 66) * (0.015 + overloadRatio * 0.025) : 0

    meshRef.current.position.set(shudderX, -0.2 + shudderY, shudderZ)

    // Breathing displacement when deformation is ON
    if (deformation) {
      meshRef.current.scale.set(
        1.0 + Math.sin(t * 2) * defScale * 0.15,
        1.0 + Math.cos(t * 1.8) * defScale * 0.1,
        1.0 + Math.sin(t * 2) * defScale * 0.15
      )
    } else {
      meshRef.current.scale.set(1, 1, 1)
    }
  })

  // Colors based on stress, threshold state and palette
  const filletColor =
    palette === 'rainbow'
      ? isCritical
        ? '#dc2626'
        : peakStress > 200
          ? '#ef4444'
          : '#f59e0b'
      : isCritical
        ? '#f43f5e'
        : peakStress > 200
          ? '#fde047'
          : '#22c55e'

  const bodyColor = palette === 'rainbow' ? (isCritical ? '#0369a1' : '#0284c7') : '#21918c'

  return (
    <group scale={0.88} position={[0, -0.15, 0]}>
      <group ref={meshRef} position={[0, -0.2, 0]} rotation={[0.4, -0.6, 0]}>
        {/* 1. Base Large Drive Journal - Solid */}
        <mesh position={[0, -0.9, 0]}>
          <cylinderGeometry args={[0.82, 0.82, 1.5, 32, 12]} />
          <meshStandardMaterial
            color={bodyColor}
            metalness={0.55}
            roughness={0.25}
          />
        </mesh>
        {feaGrid && (
          <mesh position={[0, -0.9, 0]}>
            <cylinderGeometry args={[0.824, 0.824, 1.504, 24, 10]} />
            <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.45} />
          </mesh>
        )}

        {/* 2. Transition Fillet Collar (High Stress Zone) - Incandescent Glowing Red when Critical */}
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.6, 0.82, 0.4, 32, 8]} />
          <meshStandardMaterial
            color={filletColor}
            emissive={isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#000000'}
            emissiveIntensity={isCritical ? 2.2 : isWarning ? 0.6 : 0}
            metalness={0.7}
            roughness={0.2}
          />
        </mesh>
        {feaGrid && (
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.604, 0.824, 0.404, 24, 6]} />
            <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.45} />
          </mesh>
        )}

        {/* Dynamic Micro-Crack Propagation on Yield Exceedance */}
        {isCritical && <FractureCrackOverlay position={[0, 0.05, 0]} scale={1.05} />}

        {/* 3. Upper Stepped Shaft Section - Solid */}
        <mesh position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.54, 0.54, 1.8, 32, 14]} />
          <meshStandardMaterial
            color={isCritical ? '#b91c1c' : '#38bdf8'}
            emissive={isCritical ? '#ef4444' : '#000000'}
            emissiveIntensity={isCritical ? 0.8 : 0}
            metalness={0.6}
            roughness={0.25}
          />
        </mesh>
        {feaGrid && (
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.544, 0.544, 1.804, 24, 12]} />
            <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.45} />
          </mesh>
        )}

        {/* 4. Drive Shaft Keyway Root Slot */}
        <mesh position={[0.54, 1.0, 0]}>
          <boxGeometry args={[0.12, 1.0, 0.18]} />
          <meshStandardMaterial
            color={isCritical ? '#ef4444' : peakStress > 180 ? '#f59e0b' : '#38bdf8'}
            emissive={isCritical ? '#ef4444' : '#000000'}
            emissiveIntensity={isCritical ? 1.4 : 0}
            metalness={0.8}
            roughness={0.15}
          />
        </mesh>

        {/* 5. Undeformed Ghost Wireframe Overlay */}
        {ghostWire && (
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.85, 0.85, 3.6, 16, 8]} />
            <meshBasicMaterial color="#94a3b8" wireframe transparent opacity={0.3} />
          </mesh>
        )}

        {/* 6. Glowing Red Hotspot Torus Rings */}
        {hotspots && (
          <>
            <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.74, 0.06, 16, 36]} />
              <meshBasicMaterial color="#ef4444" />
            </mesh>
            <mesh position={[0.58, 1.0, 0]}>
              <sphereGeometry args={[isCritical ? 0.18 : 0.12, 16, 16]} />
              <meshBasicMaterial color="#ef4444" />
            </mesh>
          </>
        )}
      </group>
    </group>
  )
}

/** 3D Centrifugal Impeller Model (Pump-001) */
function ImpellerMesh({
  exaggeration,
  deformation,
  ghostWire,
  feaGrid,
  hotspots,
  palette,
  peakStress,
  isCritical,
  isWarning,
  overloadRatio,
}: ModelProps) {
  const impellerRef = useRef<THREE.Group>(null)
  const defScale = deformation ? (exaggeration / 35) * (peakStress / 350) * 0.08 : 0

  useFrame(({ clock }) => {
    if (!impellerRef.current) return
    const t = clock.getElapsedTime()
    const shudderX = isCritical ? Math.sin(t * 60) * (0.02 + overloadRatio * 0.035) : 0
    const shudderY = isCritical ? Math.cos(t * 54) * (0.02 + overloadRatio * 0.035) : 0
    const shudderZ = isCritical ? Math.sin(t * 68) * (0.015 + overloadRatio * 0.025) : 0

    impellerRef.current.position.set(shudderX, shudderY, shudderZ)

    if (deformation) {
      impellerRef.current.scale.set(
        1.0 + Math.sin(t * 2.5) * defScale * 0.08,
        1.0 + Math.cos(t * 2.5) * defScale * 0.08,
        1.0 + Math.sin(t * 2.5) * defScale * 0.08
      )
    } else {
      impellerRef.current.scale.set(1, 1, 1)
    }
  })

  // Blade color gradient: Green at outer diameter, yellow/red at hub root
  const rootColor =
    palette === 'rainbow'
      ? isCritical
        ? '#dc2626'
        : peakStress > 220
          ? '#ef4444'
          : '#f59e0b'
      : isCritical
        ? '#f43f5e'
        : peakStress > 220
          ? '#fde047'
          : '#22c55e'

  const tipColor = palette === 'rainbow' ? '#22c55e' : '#21918c'

  return (
    <group scale={0.84} position={[0, -0.1, 0]}>
      <group ref={impellerRef} position={[0, 0, 0]} rotation={[0.4, 0.2, 0]}>
        {/* 1. Central Impeller Hub & Shaft Eye - Solid Bronze */}
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.72, 0.76, 0.75, 32]} />
          <meshStandardMaterial
            color="#ca8a04"
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
        {feaGrid && (
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.724, 0.764, 0.754, 24, 6]} />
            <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.45} />
          </mesh>
        )}

        {/* Shaft Bore Inner Hole */}
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 0.8, 24]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
        </mesh>

        {/* 2. Impeller Bottom Shroud Disc - Solid Emerald */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[2.35, 2.35, 0.06, 48]} />
          <meshStandardMaterial
            color={isCritical ? '#991b1b' : '#059669'}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
        {feaGrid && (
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[2.354, 2.354, 0.064, 32, 4]} />
            <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.4} />
          </mesh>
        )}

        {/* 3. Six Backward-Curved Impeller Vanes with FEA Stress Gradient */}
        {[0, 1, 2, 3, 4, 5].map((idx) => {
          const angle = (idx / 6) * Math.PI * 2
          return (
            <group key={idx} rotation={[0, angle, 0]}>
              {/* Vane Root Section (High Stress Cantilever Connection) */}
              <mesh position={[0.88, 0.34, 0]} rotation={[0, -0.4, 0]}>
                <boxGeometry args={[0.42, 0.62, 0.07]} />
                <meshStandardMaterial
                  color={rootColor}
                  emissive={isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#000000'}
                  emissiveIntensity={isCritical ? 2.0 : isWarning ? 0.6 : 0}
                  metalness={0.65}
                  roughness={0.25}
                />
              </mesh>
              {feaGrid && (
                <mesh position={[0.88, 0.34, 0]} rotation={[0, -0.4, 0]}>
                  <boxGeometry args={[0.424, 0.624, 0.074]} />
                  <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.45} />
                </mesh>
              )}

              {/* Vane Mid Curve */}
              <mesh position={[1.35, 0.3, 0.24]} rotation={[0, -0.75, 0]}>
                <boxGeometry args={[0.62, 0.54, 0.06]} />
                <meshStandardMaterial
                  color={isCritical ? '#ef4444' : '#eab308'}
                  emissive={isCritical ? '#ef4444' : '#000000'}
                  emissiveIntensity={isCritical ? 1.0 : 0}
                  metalness={0.65}
                  roughness={0.25}
                />
              </mesh>
              {feaGrid && (
                <mesh position={[1.35, 0.3, 0.24]} rotation={[0, -0.75, 0]}>
                  <boxGeometry args={[0.624, 0.544, 0.064]} />
                  <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.45} />
                </mesh>
              )}

              {/* Vane Outer Discharge Tip */}
              <mesh position={[1.88, 0.25, 0.68]} rotation={[0, -1.15, 0]}>
                <boxGeometry args={[0.75, 0.44, 0.05]} />
                <meshStandardMaterial
                  color={tipColor}
                  metalness={0.65}
                  roughness={0.25}
                />
              </mesh>
              {feaGrid && (
                <mesh position={[1.88, 0.25, 0.68]} rotation={[0, -1.15, 0]}>
                  <boxGeometry args={[0.754, 0.444, 0.054]} />
                  <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.45} />
                </mesh>
              )}
            </group>
          )
        })}

        {/* Dynamic Micro-Crack Propagation on Yield Exceedance */}
        {isCritical && <FractureCrackOverlay position={[0, 0.35, 0]} scale={1.1} />}

        {/* 4. Undeformed Ghost Wireframe */}
        {ghostWire && (
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[2.4, 2.4, 0.8, 24, 4]} />
            <meshBasicMaterial color="#94a3b8" wireframe transparent opacity={0.25} />
          </mesh>
        )}

        {/* 5. Glowing Red Hotspots at Vane Roots */}
        {hotspots && (
          <>
            <mesh position={[0.85, 0.45, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.08, 0.24, 16]} />
              <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[-0.85, 0.45, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.08, 0.24, 16]} />
              <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
            </mesh>
          </>
        )}
      </group>
    </group>
  )
}

/** 3D Ball Bearing Model (Machine-002) - Matches User Screenshot 3 */
function BearingMesh({
  spindleRpm,
  exaggeration,
  deformation,
  ghostWire,
  feaGrid,
  hotspots,
  palette,
  peakStress,
  isCritical,
  isWarning,
  overloadRatio,
}: ModelProps) {
  const ballsGroup = useRef<THREE.Group>(null)
  const bearingRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (ballsGroup.current) {
      // Roll balls along raceway proportional to spindle RPM
      ballsGroup.current.rotation.z = t * (spindleRpm / 1500)
    }
    const shudderX = isCritical ? Math.sin(t * 62) * (0.022 + overloadRatio * 0.035) : 0
    const shudderY = isCritical ? Math.cos(t * 58) * (0.022 + overloadRatio * 0.035) : 0

    if (deformation && bearingRef.current) {
      const defScale = (exaggeration / 35) * (peakStress / 350) * 0.05
      bearingRef.current.position.set(shudderX, shudderY, 0)
      bearingRef.current.scale.set(
        1.0 + Math.sin(t * 2) * defScale,
        1.0 + Math.cos(t * 2) * defScale,
        1.0
      )
    } else if (bearingRef.current) {
      bearingRef.current.position.set(shudderX, shudderY, 0)
      bearingRef.current.scale.set(1, 1, 1)
    }
  })

  const loadedColor =
    palette === 'rainbow'
      ? isCritical
        ? '#dc2626'
        : peakStress > 280
          ? '#ef4444'
          : '#f59e0b'
      : isCritical
        ? '#f43f5e'
        : peakStress > 280
          ? '#fde047'
          : '#22c55e'

  return (
    <group scale={0.88} position={[0, 0, 0]}>
      <group ref={bearingRef} rotation={[0.4, 0.4, 0]}>
        {/* 1. Outer Raceway Ring in Solid Gunmetal Steel */}
        <mesh>
          <torusGeometry args={[1.78, 0.26, 24, 48]} />
          <meshStandardMaterial
            color="#475569"
            metalness={0.85}
            roughness={0.2}
          />
        </mesh>
        {feaGrid && (
          <mesh>
            <torusGeometry args={[1.784, 0.264, 18, 36]} />
            <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.45} />
          </mesh>
        )}

        {/* 2. Inner Raceway Ring with FEA Von Mises Stress Heatmap - Solid */}
        <mesh>
          <torusGeometry args={[1.12, 0.22, 24, 48]} />
          <meshStandardMaterial
            color={loadedColor}
            emissive={isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#000000'}
            emissiveIntensity={isCritical ? 2.2 : isWarning ? 0.6 : 0}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        {feaGrid && (
          <mesh>
            <torusGeometry args={[1.124, 0.224, 18, 36]} />
            <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.45} />
          </mesh>
        )}

        {/* Dynamic Micro-Crack Propagation on Raceway Yield Exceedance */}
        {isCritical && <FractureCrackOverlay position={[0, 0, 0]} scale={1.35} />}

        {/* 3. Rolling Spheres (12 Precision Ball Bearings) - Polished Chrome */}
        <group ref={ballsGroup}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
            const angle = (i / 12) * Math.PI * 2
            const isLoaded = i === 1 || i === 2
            return (
              <group key={i} position={[Math.cos(angle) * 1.45, Math.sin(angle) * 1.45, 0]}>
                <mesh castShadow>
                  <sphereGeometry args={[0.22, 20, 20]} />
                  <meshStandardMaterial
                    color={isCritical ? '#ef4444' : isLoaded && peakStress > 200 ? '#fbbf24' : '#f8fafc'}
                    emissive={isCritical ? '#f87171' : '#000000'}
                    emissiveIntensity={isCritical ? 1.5 : 0}
                    metalness={0.95}
                    roughness={0.08}
                  />
                </mesh>
                {feaGrid && (
                  <mesh>
                    <sphereGeometry args={[0.224, 12, 12]} />
                    <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.4} />
                  </mesh>
                )}
              </group>
            )
          })}
        </group>

        {/* 4. Ghost Wireframe */}
        {ghostWire && (
          <mesh>
            <torusGeometry args={[1.82, 0.28, 12, 24]} />
            <meshBasicMaterial color="#94a3b8" wireframe transparent opacity={0.3} />
          </mesh>
        )}

        {/* 5. Glowing Red Hotspot Discs at Hertzian Arc */}
        {hotspots && (
          <>
            <mesh position={[1.02, 0.85, 0.05]} rotation={[0, 0, Math.PI / 4]}>
              <ringGeometry args={[0.1, 0.28, 20]} />
              <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[1.42, 0.35, 0.05]}>
              <ringGeometry args={[0.08, 0.22, 20]} />
              <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
            </mesh>
          </>
        )}
      </group>
    </group>
  )
}

/** 3D Articulated Arm Joint Model (Machine-003) - Matches User Screenshot 4 */
function ArmJointMesh({
  exaggeration,
  deformation,
  ghostWire,
  feaGrid,
  hotspots,
  palette,
  peakStress,
  isCritical,
  isWarning,
  overloadRatio,
}: ModelProps) {
  const jointRef = useRef<THREE.Group>(null)
  const defScale = deformation ? (exaggeration / 35) * (peakStress / 350) * 0.06 : 0

  useFrame(({ clock }) => {
    if (!jointRef.current) return
    const t = clock.getElapsedTime()
    const shudderX = isCritical ? Math.sin(t * 60) * (0.02 + overloadRatio * 0.035) : 0
    const shudderZ = isCritical ? Math.cos(t * 55) * (0.015 + overloadRatio * 0.025) : 0

    if (deformation) {
      jointRef.current.position.set(shudderX, 0.1 + Math.sin(t * 2) * defScale, shudderZ)
    } else {
      jointRef.current.position.set(shudderX, 0.1, shudderZ)
    }
  })

  const stressColor =
    palette === 'rainbow'
      ? isCritical
        ? '#dc2626'
        : peakStress > 220
          ? '#ef4444'
          : '#f59e0b'
      : isCritical
        ? '#f43f5e'
        : peakStress > 220
          ? '#fde047'
          : '#22c55e'

  return (
    <group scale={0.88} position={[0, -0.15, 0]}>
      <group ref={jointRef} rotation={[0.2, -0.4, 0]}>
        {/* 1. Upper Arm Link Segment - Solid Industrial Green */}
        <mesh position={[0, 0.8, 0]} castShadow>
          <boxGeometry args={[1.45, 2.2, 1.15, 12, 16, 12]} />
          <meshStandardMaterial
            color={isCritical ? '#14532d' : '#16a34a'}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
        {feaGrid && (
          <mesh position={[0, 0.8, 0]}>
            <boxGeometry args={[1.456, 2.206, 1.156]} />
            <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.45} />
          </mesh>
        )}

        {/* 2. High Stress Clevis Fillet Zone - Solid */}
        <mesh position={[0, 0.1, 0.6]}>
          <boxGeometry args={[1.1, 0.8, 0.08]} />
          <meshStandardMaterial
            color={stressColor}
            emissive={isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#000000'}
            emissiveIntensity={isCritical ? 2.0 : isWarning ? 0.6 : 0}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>

        {/* Dynamic Micro-Crack Propagation on Clevis Yield Exceedance */}
        {isCritical && <FractureCrackOverlay position={[0, 0.1, 0.6]} scale={1.1} />}

        {/* 3. Transverse Pin Bore Boss - Solid Azure Steel */}
        <mesh position={[0, 0.9, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.52, 0.52, 1.85, 24]} />
          <meshStandardMaterial
            color={isCritical ? '#075985' : '#0284c7'}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        {feaGrid && (
          <mesh position={[0, 0.9, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.524, 0.524, 1.854, 18, 6]} />
            <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.45} />
          </mesh>
        )}

        {/* 4. Ghost Wireframe */}
        {ghostWire && (
          <mesh position={[0, 0.8, 0]}>
            <boxGeometry args={[1.5, 2.25, 1.2]} />
            <meshBasicMaterial color="#94a3b8" wireframe transparent opacity={0.3} />
          </mesh>
        )}

        {/* 5. Glowing Hotspot Markers */}
        {hotspots && (
          <>
            <mesh position={[0.62, 0.45, 0.58]} rotation={[0, 0, 0]}>
              <ringGeometry args={[0.08, 0.22, 16]} />
              <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0.68, 0.9, 0]} rotation={[0, Math.PI / 2, 0]}>
              <ringGeometry args={[0.08, 0.22, 16]} />
              <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
            </mesh>
          </>
        )}
      </group>
    </group>
  )
}

// ==============================================================================
// 3. INTERACTIVE 3D SCENE WRAPPER (SMOOTH ROTATION & CAMERA SNAPPING)
// ==============================================================================

function SceneWrapper({
  autoRotate,
  cameraView,
  children,
}: {
  autoRotate: boolean
  cameraView: 'iso' | 'front' | 'top'
  children: React.ReactNode
}) {
  const groupRef = useRef<THREE.Group>(null)
  const isDragging = useRef(false)
  const previousPointer = useRef({ x: 0, y: 0 })
  const rotationEuler = useRef<THREE.Euler>(new THREE.Euler(0.35, -0.45, 0))

  useEffect(() => {
    if (cameraView === 'iso') {
      rotationEuler.current.set(0.35, -0.45, 0)
    } else if (cameraView === 'front') {
      rotationEuler.current.set(0, 0, 0)
    } else if (cameraView === 'top') {
      rotationEuler.current.set(Math.PI / 2, 0, 0)
    }
  }, [cameraView])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // Auto-rotate smoothly when active and not dragging
    if (autoRotate && !isDragging.current) {
      rotationEuler.current.y += delta * 0.85
    }

    // Smooth lerp to target euler
    groupRef.current.rotation.x += (rotationEuler.current.x - groupRef.current.rotation.x) * 0.15
    groupRef.current.rotation.y += (rotationEuler.current.y - groupRef.current.rotation.y) * 0.15
    groupRef.current.rotation.z += (rotationEuler.current.z - groupRef.current.rotation.z) * 0.15
  })

  return (
    <group
      ref={groupRef}
      onPointerDown={(e) => {
        isDragging.current = true
        previousPointer.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerMove={(e) => {
        if (!isDragging.current) return
        const deltaX = e.clientX - previousPointer.current.x
        const deltaY = e.clientY - previousPointer.current.y
        rotationEuler.current.y += deltaX * 0.008
        rotationEuler.current.x += deltaY * 0.008
        previousPointer.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={() => {
        isDragging.current = false
      }}
      onPointerLeave={() => {
        isDragging.current = false
      }}
    >
      {children}
    </group>
  )
}

// ==============================================================================
// 4. MASTER FEA STRESS ANALYSIS PAGE COMPONENT
// ==============================================================================

export default function StressAnalysisPage() {
  const { play } = useSound()

  // 1. Asset & Component Selection
  const [selectedMachineId, setSelectedMachineId] = useState('Motor-001')
  const activeMachine = useMemo(
    () => MACHINES_DATA.find((m) => m.id === selectedMachineId) ?? MACHINES_DATA[4],
    [selectedMachineId]
  )

  const [selectedComponentIndex, setSelectedComponentIndex] = useState(0)
  const activeComponent = activeMachine.components[selectedComponentIndex] ?? activeMachine.components[0]

  // 2. What-If Operational Drivers
  const [feedRate, setFeedRate] = useState(100) // %
  const [spindleRpm, setSpindleRpm] = useState(3200) // RPM
  const [driveTorque, setDriveTorque] = useState(48) // Nm
  const [thermalLoad, setThermalLoad] = useState(15) // deg C

  // 3. Deformation & Mesh View Controls
  const [exaggeration, setExaggeration] = useState(35)
  const [deformation, setDeformation] = useState(true)
  const [ghostWire, setGhostWire] = useState(false)
  const [feaGrid, setFeaGrid] = useState(true)
  const [hotspots, setHotspots] = useState(true)

  // 4. Viewport & Camera States
  const [palette, setPalette] = useState<'rainbow' | 'viridis'>('rainbow')
  const [autoRotate, setAutoRotate] = useState(true) // Auto-rotate active by default as shown in screenshots
  const [cameraView, setCameraView] = useState<'iso' | 'front' | 'top'>('iso')

  // Reset Nominal Handler: Reset all sliders and clear plant floor override
  const handleReset = () => {
    play('toggle')
    setFeedRate(100)
    setSpindleRpm(3200)
    setDriveTorque(48)
    setThermalLoad(15)
    useAlertStore.getState().setWhatIfOverride(null, selectedMachineId)
  }

  // Dynamic Peak Stress Calculation
  const peakStress = useMemo(() => {
    const base = activeComponent.hotspots[0]?.stress ?? 220
    const feedFactor = (feedRate - 100) * 0.45
    const rpmFactor = ((spindleRpm - 3200) / 1000) * 8.5
    const torqueFactor = (driveTorque - 48) * 0.8
    const thermalFactor = (thermalLoad - 15) * 1.2
    return Math.max(45, Math.round(base + feedFactor + rpmFactor + torqueFactor + thermalFactor))
  }, [activeComponent, feedRate, spindleRpm, driveTorque, thermalLoad])

  const yieldLimit = activeComponent.yieldStrength
  const safetyFactor = Math.max(0.42, Number((yieldLimit / Math.max(1, peakStress)).toFixed(2)))
  const isCritical = safetyFactor < 1.0 || peakStress >= yieldLimit
  const isWarning = !isCritical && (safetyFactor < 1.25 || peakStress >= yieldLimit * 0.8)
  const overloadRatio = isCritical ? Math.min(1.5, (peakStress - yieldLimit) / yieldLimit) : 0
  const maxDisplacement = (0.012 * (peakStress / 100) * (exaggeration / 35)).toFixed(3)
  const actualDisplacement = (0.012 * (peakStress / 100)).toFixed(3)

  // Synchronize FEA What-If threshold breach directly with Plant Floor & Alert Store
  const setWhatIfOverride = useAlertStore((s) => s.setWhatIfOverride)
  const prevCriticalRef = useRef(false)

  useEffect(() => {
    if (isCritical) {
      if (!prevCriticalRef.current) {
        play('denied')
      }
      setWhatIfOverride({
        machineId: selectedMachineId,
        active: true,
        status: 'CRITICAL',
        anomalyScore: Math.min(99, Math.round(76 + (1 - Math.min(1, safetyFactor)) * 60)),
        temperature: Math.round(52 + thermalLoad * 1.2),
        vibration: Number((2.8 + (spindleRpm / 1000) * 0.95 + (driveTorque / 48) * 1.1).toFixed(2)),
        safetyFactor,
        peakStress,
        reason: `FEA What-If threshold breach: ${activeComponent.name} peak stress ${peakStress} MPa exceeded yield limit ${yieldLimit} MPa (SF: ${safetyFactor}x)`,
      })
    } else if (isWarning) {
      setWhatIfOverride({
        machineId: selectedMachineId,
        active: true,
        status: 'WARNING',
        anomalyScore: 62,
        temperature: Math.round(45 + thermalLoad * 0.6),
        vibration: Number((1.8 + (spindleRpm / 1000) * 0.4).toFixed(2)),
        safetyFactor,
        peakStress,
        reason: `FEA What-If high load warning: SF dropped to ${safetyFactor}x`,
      })
    } else {
      setWhatIfOverride(null, selectedMachineId)
    }
    prevCriticalRef.current = isCritical
  }, [
    selectedMachineId,
    isCritical,
    isWarning,
    safetyFactor,
    peakStress,
    yieldLimit,
    thermalLoad,
    spindleRpm,
    driveTorque,
    activeComponent.name,
    setWhatIfOverride,
    play,
  ])

  // Cleanup on unmount or when selecting different machine
  useEffect(() => {
    return () => {
      useAlertStore.getState().setWhatIfOverride(null, selectedMachineId)
    }
  }, [selectedMachineId])

  // Dynamic 3D Continuum Cauchy Tensor Components [MPa]
  const sigmaXX = Math.round(peakStress * 0.72)
  const sigmaYY = Math.round(peakStress * 0.48)
  const sigmaZZ = Math.round(peakStress * 0.22)
  const tauXY = Math.round((driveTorque / 48) * (peakStress * 0.35))
  const tauYZ = Math.round((feedRate / 100) * (peakStress * 0.18))
  const tauZX = Math.round((spindleRpm / 3200) * (peakStress * 0.14))

  // Principal Stresses & Mohr's Invariants
  const sigma1 = Math.round(peakStress * 1.08)
  const sigma2 = Math.round(peakStress * 0.42)
  const sigma3 = Math.round(-peakStress * 0.16)
  const maxShear = Math.round((sigma1 - sigma3) / 2)
  const hydrostaticStress = Math.round((sigma1 + sigma2 + sigma3) / 3)
  const triaxiality = (hydrostaticStress / Math.max(1, peakStress)).toFixed(2)

  // Wöhler Fatigue Cycles Estimation
  const stressRatio = peakStress / yieldLimit
  const fatigueHours =
    stressRatio < 0.65
      ? '> 50,000 hrs (Infinite Life)'
      : stressRatio < 0.85
        ? `${Math.round((1 - stressRatio) * 45000 + 4200)} hrs (High-Cycle Fatigue)`
        : `${Math.round(Math.max(180, (1 - stressRatio + 0.08) * 6500))} hrs (Low-Cycle Alert)`

  return (
    <div className="space-y-3">
      {/* OPERATIONS HEADER & BREADCRUMB */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase">
            ● OPERATIONS · MECHANICAL CONTINUUM
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white font-mono">FEA Stress analysis</h1>
          <p className="text-xs text-slate-400 font-mono">
            Finite element continuum visualization & exaggerated deformation fields
          </p>
        </div>

        {/* Top-Right Quick Navigation Links */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/stethoscope"
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span>Stethoscope</span>
          </Link>
          <Link
            to="/digital-twin"
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Gauge className="h-3.5 w-3.5 text-blue-400" />
            <span>Digital Twin</span>
          </Link>
          <Link
            to="/ai-assistant"
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Workflow className="h-3.5 w-3.5 text-purple-400" />
            <span>Root Cause</span>
          </Link>
          <Link
            to="/what-if"
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>What-If</span>
          </Link>
          <Link
            to="/god-view"
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-mono text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Boxes className="h-3.5 w-3.5 text-emerald-400" />
            <span>Plant Floor</span>
          </Link>
        </div>
      </div>

      {/* ACTIVE INDUSTRIAL ASSET SELECTOR BAR */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 shadow-md space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono font-bold tracking-wider text-slate-400 uppercase">
              ACTIVE INDUSTRIAL ASSET:
            </span>
            {MACHINES_DATA.map((m) => {
              const isSelected = selectedMachineId === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    play('toggle')
                    setSelectedMachineId(m.id)
                    setSelectedComponentIndex(0)
                  }}
                  className={`rounded-lg px-2.5 py-0.5 text-xs font-mono transition-all ${
                    isSelected
                      ? 'bg-[#c2621a] text-white border border-[#e07a2c] font-bold shadow-lg shadow-orange-950/40'
                      : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {m.shortLabel}
                </button>
              )
            })}
          </div>
          <div className="text-xs font-mono text-slate-400">
            Selected: <span className="font-bold text-white">{activeMachine.id}</span>
          </div>
        </div>

        {/* SELECT STRUCTURAL COMPONENT BAR */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-slate-400">
              SELECT STRUCTURAL COMPONENT ({activeMachine.components.length}):
            </span>
            {activeMachine.components.map((comp, idx) => {
              const isActive = selectedComponentIndex === idx
              return (
                <button
                  key={comp.name}
                  type="button"
                  onClick={() => {
                    play('click')
                    setSelectedComponentIndex(idx)
                  }}
                  className={`flex items-center gap-2 rounded-md px-2 py-0.5 text-xs font-mono transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white border border-white/20 font-bold shadow-sm'
                      : 'bg-slate-950/60 text-slate-400 border border-slate-800/60 hover:text-white'
                  }`}
                >
                  <span>{comp.name}</span>
                  <span
                    className={`rounded px-1 text-[9px] font-bold ${
                      isActive ? 'bg-amber-500/30 text-amber-300' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {comp.category}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="text-xs font-mono text-slate-400">
            Category: <span className="font-bold text-amber-400">{activeComponent.category}</span>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN LAYOUT: 3D VIEWPORT (LEFT) & DRIVERS / CONTROLS (RIGHT) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* LEFT COLUMN: 3D FEA CONTINUUM CANVAS & CONTINUUM TENSOR MATRIX */}
        <div className="space-y-3 lg:col-span-7 xl:col-span-8">
          {/* 3D FEA CONTINUUM CANVAS CONTAINER */}
          <div className="relative rounded-2xl border border-slate-800 bg-[#06080d] overflow-hidden min-h-[480px] h-[480px] lg:h-[500px]">
            {/* Top-Right Badge */}
            <div className="absolute top-3 right-3 z-10 text-right">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-[11px] font-mono text-amber-300 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Visualization / Estimated Stress Field</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                Mesh-based continuum approximation (Uncertified)
              </div>
            </div>

            {/* Top-Left STRESS FIELD Legend Box */}
            <div className="absolute top-3 left-3 z-10 w-44 rounded-xl border border-slate-800/80 bg-slate-950/85 p-3 font-mono text-xs shadow-2xl backdrop-blur-md space-y-2">
              <div className="text-[10px] font-bold uppercase text-slate-400">
                STRESS FIELD <span className="text-[9px] lowercase text-slate-500">von Mises [MPa]</span>
              </div>

              {/* 6-Level Color Scale Bar */}
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-3.5 rounded-sm bg-red-500" />
                  <span className="font-bold text-red-400">{peakStress} MPa</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-3.5 rounded-sm bg-orange-500" />
                  <span className="text-orange-300">{Math.round(peakStress * 0.81)} MPa</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-3.5 rounded-sm bg-yellow-500" />
                  <span className="text-yellow-300">{Math.round(peakStress * 0.62)} MPa</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-3.5 rounded-sm bg-green-500" />
                  <span className="text-green-300">{Math.round(peakStress * 0.43)} MPa</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-3.5 rounded-sm bg-cyan-500" />
                  <span className="text-cyan-300">{Math.round(peakStress * 0.25)} MPa</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-3.5 rounded-sm bg-blue-600" />
                  <span className="text-sky-300">16 MPa</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 text-[11px] space-y-1">
                <div className="text-slate-400">
                  Yield Limit (Re): <span className="font-bold text-white">{yieldLimit} MPa</span>
                </div>
                <div className="text-slate-400">
                  Safety Factor (SF):{' '}
                  <span
                    className={`font-bold ${
                      safetyFactor < 1.1
                        ? 'text-red-400 animate-pulse'
                        : safetyFactor < 1.4
                          ? 'text-amber-400'
                          : 'text-green-400'
                    }`}
                  >
                    {safetyFactor}x
                  </span>
                </div>
              </div>

              {/* Palette Switcher */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
                <span className="text-slate-400">Palette:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPalette('rainbow')}
                    className={`rounded px-1.5 py-0.5 font-bold transition-colors ${
                      palette === 'rainbow'
                        ? 'bg-[#c2621a] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Rainbow
                  </button>
                  <button
                    type="button"
                    onClick={() => setPalette('viridis')}
                    className={`rounded px-1.5 py-0.5 font-bold transition-colors ${
                      palette === 'viridis'
                        ? 'bg-[#c2621a] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Viridis
                  </button>
                </div>
              </div>
            </div>

            {/* CRITICAL STRUCTURAL YIELD BREACH ALERT BANNER OVERLAY */}
            {isCritical && (
              <div className="absolute top-12 left-3 right-3 z-30 flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-red-500 bg-red-950/95 px-4 py-2.5 shadow-[0_0_40px_rgba(239,68,68,0.7)] backdrop-blur-md animate-pulse font-mono">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 animate-bounce" />
                  <div>
                    <div className="text-xs font-bold text-red-200 uppercase tracking-wider">
                      ⚠️ CRITICAL YIELD EXCEEDED: SAFETY FACTOR {safetyFactor}x &lt; 1.00x
                    </div>
                    <div className="text-[10px] text-red-300">
                      Active plastic strain in {activeComponent.name}. Plant floor {selectedMachineId} triggered into red strobing emergency alert!
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/god-view"
                    className="flex items-center gap-1 rounded bg-slate-900/90 hover:bg-slate-800 border border-red-500/60 px-2.5 py-1 text-[11px] font-bold text-red-300 hover:text-white transition-colors"
                  >
                    <Boxes className="h-3 w-3" />
                    <span>View on Floor</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1 rounded bg-red-600 hover:bg-red-500 px-3 py-1 text-[11px] font-bold text-white shadow transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset Nominal</span>
                  </button>
                </div>
              </div>
            )}

            {/* THREE.JS FEA STRESS CONTINUUM 3D CANVAS */}
            <Canvas
              camera={{ position: [0, 1.3, 5.0], fov: 40 }}
              className="h-[480px] lg:h-[500px] w-full"
              gl={{ antialias: true, powerPreference: 'high-performance' }}
            >
              <ambientLight intensity={isCritical ? 1.2 : 1.5} />
              <directionalLight position={[6, 9, 6]} intensity={2.2} />
              <pointLight position={[-6, 4, -4]} intensity={1.0} color="#38bdf8" />
              <pointLight position={[6, 4, 4]} intensity={1.0} color="#f59e0b" />
              <pointLight position={[0, 4, 0]} intensity={isCritical ? 3.8 : 0} color="#ef4444" distance={12} />
              <directionalLight position={[-4, -4, -4]} intensity={0.6} color="#60a5fa" />

              <SceneWrapper autoRotate={autoRotate} cameraView={cameraView}>
                {activeComponent.modelType === 'impeller' && (
                  <ImpellerMesh
                    feedRate={feedRate}
                    spindleRpm={spindleRpm}
                    driveTorque={driveTorque}
                    thermalLoad={thermalLoad}
                    exaggeration={exaggeration}
                    deformation={deformation}
                    ghostWire={ghostWire}
                    feaGrid={feaGrid}
                    hotspots={hotspots}
                    palette={palette}
                    peakStress={peakStress}
                    yieldLimit={yieldLimit}
                    isCritical={isCritical}
                    isWarning={isWarning}
                    overloadRatio={overloadRatio}
                  />
                )}
                {activeComponent.modelType === 'bearing' && (
                  <BearingMesh
                    feedRate={feedRate}
                    spindleRpm={spindleRpm}
                    driveTorque={driveTorque}
                    thermalLoad={thermalLoad}
                    exaggeration={exaggeration}
                    deformation={deformation}
                    ghostWire={ghostWire}
                    feaGrid={feaGrid}
                    hotspots={hotspots}
                    palette={palette}
                    peakStress={peakStress}
                    yieldLimit={yieldLimit}
                    isCritical={isCritical}
                    isWarning={isWarning}
                    overloadRatio={overloadRatio}
                  />
                )}
                {activeComponent.modelType === 'joint' && (
                  <ArmJointMesh
                    feedRate={feedRate}
                    spindleRpm={spindleRpm}
                    driveTorque={driveTorque}
                    thermalLoad={thermalLoad}
                    exaggeration={exaggeration}
                    deformation={deformation}
                    ghostWire={ghostWire}
                    feaGrid={feaGrid}
                    hotspots={hotspots}
                    palette={palette}
                    peakStress={peakStress}
                    yieldLimit={yieldLimit}
                    isCritical={isCritical}
                    isWarning={isWarning}
                    overloadRatio={overloadRatio}
                  />
                )}
                {activeComponent.modelType === 'shaft' && (
                  <ShaftMesh
                    feedRate={feedRate}
                    spindleRpm={spindleRpm}
                    driveTorque={driveTorque}
                    thermalLoad={thermalLoad}
                    exaggeration={exaggeration}
                    deformation={deformation}
                    ghostWire={ghostWire}
                    feaGrid={feaGrid}
                    hotspots={hotspots}
                    palette={palette}
                    peakStress={peakStress}
                    yieldLimit={yieldLimit}
                    isCritical={isCritical}
                    isWarning={isWarning}
                    overloadRatio={overloadRatio}
                  />
                )}
              </SceneWrapper>
            </Canvas>

            {/* Bottom-Right ANALYSIS TARGET Box */}
            <div className="absolute bottom-3 right-3 rounded-xl bg-slate-950/85 px-3 py-2 text-right backdrop-blur-md border border-slate-800 font-mono text-xs">
              <div className="text-[10px] font-bold uppercase text-slate-400">ANALYSIS TARGET</div>
              <div className="font-bold text-white">{activeComponent.name}</div>
              <div className="text-[11px] text-amber-300">
                σ_peak: <span className="font-bold">{peakStress} MPa</span> | δ_max:{' '}
                <span className="font-bold">{maxDisplacement} mm</span>
              </div>
            </div>

            {/* Bottom-Left Camera Controls & Auto-Rotate Button */}
            <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-xl bg-slate-950/85 p-1 border border-slate-800 text-[11px] font-mono backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  play('click')
                  setCameraView('iso')
                }}
                className={`rounded-lg px-2.5 py-1 transition-colors ${
                  cameraView === 'iso' ? 'bg-[#c2621a] text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Isometric
              </button>
              <button
                type="button"
                onClick={() => {
                  play('click')
                  setCameraView('front')
                }}
                className={`rounded-lg px-2.5 py-1 transition-colors ${
                  cameraView === 'front' ? 'bg-[#c2621a] text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Front Elevation
              </button>
              <button
                type="button"
                onClick={() => {
                  play('click')
                  setCameraView('top')
                }}
                className={`rounded-lg px-2.5 py-1 transition-colors ${
                  cameraView === 'top' ? 'bg-[#c2621a] text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Top Plan
              </button>
              <button
                type="button"
                onClick={() => {
                  play('toggle')
                  setAutoRotate(!autoRotate)
                }}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  autoRotate
                    ? 'bg-[#c2621a] text-white font-bold shadow-md shadow-orange-950/50'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {autoRotate ? 'Rotating' : 'Auto-Rotate'}
              </button>
            </div>
          </div>

          {/* CAUCHY STRESS TENSOR & MOHR'S PRINCIPAL INVARIANTS PANEL */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
              <div className="flex items-center gap-1.5 font-bold text-white uppercase text-xs">
                <span className="text-cyan-400">❖</span>
                <span>CAUCHY STRESS TENSOR & PRINCIPAL AXES [MPa]</span>
              </div>
              <span className="text-[10px] text-slate-400">Dynamic 3D Element Formulation</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* 1. Symmetric Cauchy Tensor Matrix */}
              <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5 space-y-1.5">
                <div className="text-[10px] uppercase font-bold text-slate-400">3x3 Cauchy Matrix [σ_ij]</div>
                <div className="grid grid-cols-3 gap-1 text-center text-[10px] font-bold">
                  <div className="rounded bg-sky-950/40 border border-sky-800/40 py-1 text-sky-300">σxx {sigmaXX}</div>
                  <div className="rounded bg-slate-800/50 py-1 text-amber-300">τxy {tauXY}</div>
                  <div className="rounded bg-slate-800/50 py-1 text-slate-400">τxz {tauZX}</div>

                  <div className="rounded bg-slate-800/50 py-1 text-amber-300">τyx {tauXY}</div>
                  <div className="rounded bg-sky-950/40 border border-sky-800/40 py-1 text-sky-300">σyy {sigmaYY}</div>
                  <div className="rounded bg-slate-800/50 py-1 text-slate-400">τyz {tauYZ}</div>

                  <div className="rounded bg-slate-800/50 py-1 text-slate-400">τzx {tauZX}</div>
                  <div className="rounded bg-slate-800/50 py-1 text-slate-400">τzy {tauYZ}</div>
                  <div className="rounded bg-sky-950/40 border border-sky-800/40 py-1 text-sky-300">σzz {sigmaZZ}</div>
                </div>
              </div>

              {/* 2. Principal Eigen-Stresses */}
              <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">Principal Stresses (Eigenvalues)</div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Major Principal (σ₁):</span>
                    <span className="font-bold text-red-400">{sigma1} MPa</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Intermediate (σ₂):</span>
                    <span className="font-bold text-amber-300">{sigma2} MPa</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Minor Compressive (σ₃):</span>
                    <span className="font-bold text-sky-300">{sigma3} MPa</span>
                  </div>
                  <div className="flex justify-between pt-0.5 border-t border-slate-800 text-[10px]">
                    <span className="text-slate-500">Max Shear (τ_max):</span>
                    <span className="font-bold text-white">{maxShear} MPa</span>
                  </div>
                </div>
              </div>

              {/* 3. Hydrostatic & Fracture Triaxiality */}
              <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">Multiaxiality & Failure State</div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hydrostatic (σ_m):</span>
                    <span className="font-bold text-white">{hydrostaticStress} MPa</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Stress Triaxiality (η):</span>
                    <span className="font-bold text-cyan-300">{triaxiality}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Failure Mode:</span>
                    <span className="font-bold text-emerald-400">
                      {Number(triaxiality) > 0.6 ? 'Cleavage Voiding' : 'Ductile Shear Lip'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-0.5 border-t border-slate-800 text-[10px]">
                    <span className="text-slate-500">Yield Criterion:</span>
                    <span className="font-bold text-amber-400">Huber-von Mises</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: WHAT-IF DRIVERS & DEFORMATION CONTROLS */}
        <div className="space-y-3 lg:col-span-5 xl:col-span-4 font-mono text-xs">
          {/* WHAT-IF OPERATIONAL DRIVERS PANEL */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-white uppercase text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>WHAT-IF OPERATIONAL DRIVERS</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Dynamic computation of local stress tensors & displacement fields.
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold transition-all border shrink-0 ${
                  isCritical
                    ? 'bg-red-600 hover:bg-red-500 text-white border-red-400 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.6)]'
                    : 'bg-slate-900 text-slate-300 hover:text-amber-300 border-slate-800'
                }`}
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Nominal</span>
              </button>
            </div>

            {/* 1. Feed Rate Slider */}
            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>Feed Rate (Machining / Tool Load)</span>
                <span className="font-bold text-white">{feedRate}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={200}
                value={feedRate}
                onChange={(e) => setFeedRate(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>20% (Light)</span>
                <span>100% (Nominal)</span>
                <span>200% (Heavy Roughing)</span>
              </div>
            </div>

            {/* 2. Shaft / Spindle Velocity */}
            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>Shaft / Spindle Velocity (RPM)</span>
                <span className="font-bold text-white">{spindleRpm} rpm</span>
              </div>
              <input
                type="range"
                min={500}
                max={9000}
                step={100}
                value={spindleRpm}
                onChange={(e) => setSpindleRpm(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>500 rpm</span>
                <span>Centrifugal body force: ω²r</span>
                <span>9000 rpm</span>
              </div>
            </div>

            {/* 3. Drive Torque Load */}
            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>Drive Torque Load (Torsion)</span>
                <span className="font-bold text-white">{driveTorque} Nm</span>
              </div>
              <input
                type="range"
                min={10}
                max={120}
                value={driveTorque}
                onChange={(e) => setDriveTorque(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>10 Nm</span>
                <span>Torsional shear τ = Tr / J</span>
                <span>120 Nm</span>
              </div>
            </div>

            {/* 4. Thermal Load */}
            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>Thermal Load (Temperature Rise ΔT)</span>
                <span className="font-bold text-red-400">+{thermalLoad} °C</span>
              </div>
              <input
                type="range"
                min={0}
                max={70}
                value={thermalLoad}
                onChange={(e) => setThermalLoad(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>0 °C (Ambient)</span>
                <span>Thermal strain ε = α·ΔT</span>
                <span>+70 °C</span>
              </div>
            </div>
          </div>

          {/* DEFORMATION & MESH VIEW PANEL */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-white uppercase text-xs border-b border-slate-800/80 pb-1.5">
              <Zap className="h-3.5 w-3.5 text-cyan-400" />
              <span>DEFORMATION & MESH VIEW</span>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-0.5">
                <span>Exaggeration Scale Factor</span>
                <span className="font-bold text-cyan-300">{exaggeration}x</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={exaggeration}
                onChange={(e) => setExaggeration(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <div className="text-[10px] text-slate-500 mt-0.5">
                Visualizes micro-strain deflections ({actualDisplacement} mm actual)
              </div>
            </div>

            {/* 4 Toggle Buttons in 2 Columns matching screenshot */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  play('click')
                  setDeformation(!deformation)
                }}
                className={`flex items-center justify-between rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                  deformation
                    ? 'border-sky-500/40 bg-sky-950/30 text-sky-200'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400'
                }`}
              >
                <span>Deformation</span>
                <span className={`font-bold ${deformation ? 'text-sky-400' : 'text-slate-500'}`}>
                  {deformation ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  play('click')
                  setGhostWire(!ghostWire)
                }}
                className={`flex items-center justify-between rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                  ghostWire
                    ? 'border-sky-500/40 bg-sky-950/30 text-sky-200'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400'
                }`}
              >
                <span>Ghost Wire</span>
                <span className={`font-bold ${ghostWire ? 'text-sky-400' : 'text-slate-500'}`}>
                  {ghostWire ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  play('click')
                  setFeaGrid(!feaGrid)
                }}
                className={`flex items-center justify-between rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                  feaGrid
                    ? 'border-sky-500/40 bg-sky-950/30 text-sky-200'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400'
                }`}
              >
                <span>FEA Grid</span>
                <span className={`font-bold ${feaGrid ? 'text-sky-400' : 'text-slate-500'}`}>
                  {feaGrid ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  play('click')
                  setHotspots(!hotspots)
                }}
                className={`flex items-center justify-between rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                  hotspots
                    ? 'border-amber-500/40 bg-amber-950/30 text-amber-200'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400'
                }`}
              >
                <span>Hotspots</span>
                <span className={`font-bold ${hotspots ? 'text-amber-400' : 'text-slate-500'}`}>
                  {hotspots ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          </div>

          {/* STRESS CONCENTRATION HOTSPOTS */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-white uppercase text-xs border-b border-slate-800/80 pb-1.5">
              <span className="text-amber-400">⚡</span>
              <span>STRESS CONCENTRATION HOTSPOTS ({activeComponent.hotspots.length})</span>
            </div>

            <div className="space-y-1.5">
              {activeComponent.hotspots.map((h, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 space-y-0.5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
                        {h.tag}
                      </span>
                      <span className="font-bold text-white text-xs">{h.title}</span>
                    </div>
                    <span className="font-bold text-red-400">{h.stress} MPa</span>
                  </div>
                  <div className="text-[10px] text-slate-400">{h.description}</div>
                  <div className="flex items-center justify-between pt-0.5 text-[10px]">
                    <span className="text-slate-500">Stress concentration factor Kt: {h.kt}</span>
                    <button
                      type="button"
                      onClick={() => {
                        play('click')
                        setCameraView(i === 0 ? 'front' : 'iso')
                      }}
                      className="text-slate-400 hover:text-amber-300 cursor-pointer"
                    >
                      Click to inspect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FATIGUE ANALYSIS */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
              <div className="flex items-center gap-1.5 font-bold text-white uppercase text-xs">
                <span className="text-amber-400">⚡</span>
                <span>WÖHLER S-N FATIGUE LIFE PREDICTION</span>
              </div>
              <span className={`text-[10px] font-bold ${stressRatio > 0.8 ? 'text-red-400' : 'text-emerald-400'}`}>
                {stressRatio > 0.8 ? '● LOW CYCLE' : '● SAFE SPECTRUM'}
              </span>
            </div>
            <div className="rounded-lg bg-slate-900/60 p-2 space-y-1 border border-slate-800/80 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Fatigue Life Remaining:</span>
                <span className="font-bold text-white">{fatigueHours}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Basquin S-N Slope (b):</span>
                <span className="text-slate-300">-0.085 (Alloy Steel)</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Fatigue Strength Coeff (σ_f'):</span>
                <span className="text-slate-300">{Math.round(yieldLimit * 1.6)} MPa</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM METALLURGICAL SPECIFICATIONS */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 font-mono text-xs">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
          <div className="text-[10px] uppercase font-bold text-slate-400">Material Spec</div>
          <div className="mt-1 font-bold text-white text-sm">{activeComponent.material}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
          <div className="text-[10px] uppercase font-bold text-slate-400">Yield Strength (Re)</div>
          <div className="mt-1 font-bold text-white text-sm">{activeComponent.yieldStrength} MPa</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
          <div className="text-[10px] uppercase font-bold text-slate-400">Young's Modulus (E)</div>
          <div className="mt-1 font-bold text-white text-sm">{activeComponent.youngsModulus} GPa</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
          <div className="text-[10px] uppercase font-bold text-slate-400">Poisson's Ratio (ν)</div>
          <div className="mt-1 font-bold text-white text-sm">{activeComponent.poissonsRatio}</div>
        </div>
      </div>

      {/* INDUSTRIAL STRUCTURAL INTEGRITY & PRESCRIBED ACTION AUDIT */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold uppercase text-white">
              SOVEREIGN AI AUTONOMOUS STRUCTURAL INTEGRITY DIRECTIVE
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span>ISO 10816-3 Severity:</span>
            <span
              className={`rounded px-1.5 py-0.5 font-bold ${
                safetyFactor < 1.1
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : safetyFactor < 1.4
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {safetyFactor < 1.1
                ? 'CLASS D (UNACCEPTABLE)'
                : safetyFactor < 1.4
                  ? 'CLASS C (RESTRICTED)'
                  : 'CLASS A/B (NORMAL)'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-[11px]">
          <div className="rounded-lg bg-slate-900/50 p-2 border border-slate-800/60 space-y-0.5">
            <div className="text-[10px] text-slate-400 uppercase font-bold">1. Critical Vulnerability Hotspot</div>
            <div className="text-white font-semibold">{activeComponent.hotspots[0]?.title ?? 'Fillet Radius'}</div>
            <div className="text-[10px] text-slate-400">
              Stress concentration Kt = {activeComponent.hotspots[0]?.kt ?? '2.5x'} under cyclic loading.
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/50 p-2 border border-slate-800/60 space-y-0.5">
            <div className="text-[10px] text-slate-400 uppercase font-bold">2. Dynamic Plastic Strain Check</div>
            <div className="text-white font-semibold">
              {peakStress > yieldLimit ? 'Plastic Deformation Incurred' : 'Fully Elastic Continuum'}
            </div>
            <div className="text-[10px] text-slate-400">
              Yield Margin:{' '}
              {yieldLimit - peakStress > 0
                ? `+${yieldLimit - peakStress} MPa reserve`
                : `${yieldLimit - peakStress} MPa exceedance`}
            </div>
          </div>

          <div className="rounded-lg bg-slate-900/50 p-2 border border-slate-800/60 space-y-0.5">
            <div className="text-[10px] text-slate-400 uppercase font-bold">3. Prescribed Edge Remediation</div>
            <div className="text-amber-300 font-semibold">
              {safetyFactor < 1.2
                ? 'Reduce Feed by 25% or Spindle RPM to 2400'
                : 'Maintain Current Operational Envelope'}
            </div>
            <div className="text-[10px] text-slate-400">
              {safetyFactor < 1.2
                ? 'Mitigates micro-cracking risk before next PM cycle.'
                : 'Operating well within fatigue endurance limit.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
