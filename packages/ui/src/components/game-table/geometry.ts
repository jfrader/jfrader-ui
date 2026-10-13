import type { BoardSeatGeometry } from './types';
import { fitBoardContent, type BoardMeasurements } from './fit-layout';

/** Deliberately replaces Trucoshi's deformed profile presets with a measured curve. */
export function buildSeatGeometries(totalSeats: number, measurement?: BoardMeasurements) {
  const fitted = measurement && measurement.seats.length === totalSeats ? fitBoardContent(measurement) : undefined;
  const seatGeometries: BoardSeatGeometry[] = Array.from({ length: totalSeats }, (_, index) => {
    const theta = Math.PI / 2 + index * 2 * Math.PI / totalSeats;
    const point = fitted?.positions[index];
    const physicalAngle = point ? point.rotationDeg * Math.PI / 180 + Math.PI / 2 : theta;
    return {
      index, totalSeats, angleRad: theta, angleDeg: theta * 180 / Math.PI,
      cos: Math.cos(physicalAngle), sin: Math.sin(physicalAngle), sideStrength: Math.abs(Math.cos(physicalAngle)),
      leftPercent: point && measurement?.width ? (measurement.centerX + point.x) / measurement.width * 100 : 50,
      topPercent: point && measurement?.height ? (measurement.centerY + point.y) / measurement.height * 100 : 50,
      rotationDeg: point?.rotationDeg ?? index * 360 / totalSeats,
      scale: fitted?.scale ?? 1,
      groupShiftY: 0, seatShiftX: 0, seatShiftY: 0,
    };
  });
  return { fitted, seatGeometries };
}
