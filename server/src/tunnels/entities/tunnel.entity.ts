import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Tunnel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  ip: string;

  @Column({ default: 22 })
  sshPort: number;

  @Column()
  username: string;

  @Column({ select: false })
  password: string;

  @Column({ nullable: true })
  domain: string;

  @Column({ default: false })
  isInstalled: boolean;
}