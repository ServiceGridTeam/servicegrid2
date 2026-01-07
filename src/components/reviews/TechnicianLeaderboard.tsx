import { useTechnicianLeaderboard } from '@/hooks/useTechnicianLeaderboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Trophy, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-700">
        <Trophy className="h-4 w-4" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600">
        <span className="font-bold">2</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700">
        <span className="font-bold">3</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-8 h-8 text-muted-foreground">
      <span className="font-medium">{rank}</span>
    </div>
  );
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') {
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  }
  if (trend === 'down') {
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  }
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export function TechnicianLeaderboard() {
  const { data: leaderboard, isLoading, error } = useTechnicianLeaderboard();

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-destructive">Failed to load leaderboard</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Technician Leaderboard
        </CardTitle>
        <CardDescription>
          Rankings based on customer review ratings
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !leaderboard?.length ? (
          <EmptyState
            icon={Trophy}
            title="No rankings yet"
            description="Technician rankings will appear once reviews are submitted."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Rank</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead className="text-center">Avg Rating</TableHead>
                <TableHead className="text-center">Total Reviews</TableHead>
                <TableHead className="text-center">5-Star Reviews</TableHead>
                <TableHead className="text-center">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((entry, index) => (
                <TableRow key={entry.profile_id}>
                  <TableCell>
                    <RankBadge rank={index + 1} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className={
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-slate-100 text-slate-600' :
                          index === 2 ? 'bg-amber-100 text-amber-700' :
                          ''
                        }>
                          {entry.profile?.first_name?.[0]}{entry.profile?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {entry.profile?.first_name} {entry.profile?.last_name}
                        </p>
                        {index < 3 && (
                          <Badge variant="outline" className="text-xs">
                            Top Performer
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">
                        {entry.average_rating?.toFixed(1) || '—'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {entry.total_reviews || 0}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {entry.five_star_count || 0}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center">
                      <TrendIndicator 
                        trend={
                          entry.average_rating && entry.average_rating >= 4.5 ? 'up' :
                          entry.average_rating && entry.average_rating < 3.5 ? 'down' :
                          'stable'
                        } 
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
