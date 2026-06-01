import type { ParsedItem } from '../../types/index.js';

export interface AuditResult {
  status: 'aprobado' | 'incompleto' | 'fuera_de_plan' | 'pendiente';
  missing_components: string[];
  penalties: string[];
}

// Interfaz temporal básica, se puede expandir según las reglas de la Lic. Daniela Romina Abuin
export function auditMeal(items: ParsedItem[], isTrainingDay: boolean): AuditResult {
  const missing_components: string[] = [];
  const penalties: string[] = [];
  let status: AuditResult['status'] = 'aprobado';

  // Ejemplo de reglas genéricas a refinar:
  let hasProtein = false;
  let hasVeggies = false;
  let hasCarbs = false;

  for (const item of items) {
    const name = item.name.toLowerCase();
    
    // Check protein
    if (name.includes('pollo') || name.includes('carne') || name.includes('huevo') || name.includes('pescado') || name.includes('merluza') || name.includes('atun') || name.includes('queso') || name.includes('yogur')) {
      hasProtein = true;
    }

    // Check veggies
    if (name.includes('ensalada') || name.includes('tomate') || name.includes('lechuga') || name.includes('zanahoria') || name.includes('verdura')) {
      hasVeggies = true;
    }

    // Check carbs
    if (name.includes('arroz') || name.includes('fideos') || name.includes('papa') || name.includes('batata') || name.includes('pan') || name.includes('avena')) {
      hasCarbs = true;
    }

    // Check "fuera de plan" items
    if (name.includes('hamburguesa') || name.includes('pizza') || name.includes('medialuna') || name.includes('galletitas dulces') || name.includes('helado')) {
      status = 'fuera_de_plan';
      penalties.push(`Alimento no permitido: ${item.name}`);
    }
  }

  if (status !== 'fuera_de_plan') {
    if (!hasProtein) {
      missing_components.push('Proteína magra');
      status = 'incompleto';
    }
    if (!hasVeggies) {
      missing_components.push('Vegetales/Fibra');
      status = 'incompleto';
    }

    if (isTrainingDay && !hasCarbs) {
      missing_components.push('Carbohidratos complejos (Requeridos en día de entrenamiento)');
      status = 'incompleto';
    } else if (!isTrainingDay && hasCarbs) {
      // Regla de ejemplo: sin carbohidratos en días de no entrenamiento
      // penalties.push('Se detectaron carbohidratos en día de descanso');
      // status = 'fuera_de_plan';
    }
  }

  return {
    status,
    missing_components,
    penalties
  };
}
