export function useGradeColor() {
  function gradeColor(score: number): string {
    if (score >= 90) return '#34d399'
    if (score >= 80) return '#4d9fff'
    if (score >= 70) return '#ffb800'
    if (score >= 60) return '#ff8800'
    return '#ff4455'
  }
  return { gradeColor }
}
