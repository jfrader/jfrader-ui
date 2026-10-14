import type { BoardSeatGeometry } from './types';
import { fitBoardContent, type BoardMeasurements } from './fit-layout';

/** Bounded ellipse curve with upright seat content. */
export function buildSeatGeometries(totalSeats: number, measurement?: BoardMeasurements) {
  const fitted = measurement && measurement.seats.length === totalSeats ? fitBoardContent(measurement) : undefined;
  const seatGeometries: BoardSeatGeometry[] = Array.from({ length: totalSeats }, (_, index) => {
    const theta = Math.PI / 2 + index * 2 * Math.PI / totalSeats;
    const point = fitted?.positions[index];
    const physicalAngle = point ? Math.atan2(point.y, point.x) : theta;
    return {
      index, totalSeats, angleRad: theta, angleDeg: theta * 180 / Math.PI,
      cos: Math.cos(physicalAngle), sin: Math.sin(physicalAngle), sideStrength: Math.abs(Math.cos(physicalAngle)),
      leftPercent: point && measurement?.width ? (measurement.centerX + point.x) / measurement.width * 100 : 50,
      topPercent: point && measurement?.height ? (measurement.centerY + point.y) / measurement.height * 100 : 50,
      playLeftPercent: point && measurement?.width ? (measurement.centerX + point.playX) / measurement.width * 100 : 50,
      playTopPercent: point && measurement?.height ? (measurement.centerY + point.playY) / measurement.height * 100 : 50,
      playScale: point?.playScale ?? 1,
      rotationDeg: point?.rotationDeg ?? 0,
      scale: point?.scale ?? 1,
      groupShiftY: 0, seatShiftX: 0, seatShiftY: 0,
    };
  });
  return { fitted, seatGeometries };
}
