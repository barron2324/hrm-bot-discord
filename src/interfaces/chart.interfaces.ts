interface UserData {
  _id: {
    $oid: string
  }
  discordName: string
  userId: string
  discordserverName: string
  discordServerId: string
  totalTime: string
  sPeakingTime: string
  joinMethod: [
    {
      devicesType: string
      totalTime: {
        hours: string
        minutes: string
        seconds: string
      }
      _id: {
        $oid: string
      }
    },
  ]
  createdAt: {
    $date: string
  }
  __v: number
}

export { UserData }

interface ChartData {
  labels: string[]
  datasets: ChartDataset[]
}
export { ChartData }

interface ChartDataset {
  label: string
  data: number[]
  backgroundColor: string[]
}
export { ChartDataset }
