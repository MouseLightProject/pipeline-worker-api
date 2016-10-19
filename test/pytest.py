import time
import sys

def main():
    multiplier = 1;
    if ( len(sys.argv) > 1 and not sys.argv[1] == '' ):
        multiplier = int(sys.argv[1])
    print 'Multiplier set to {0}'.format(multiplier)
    parents, babies = (1, 1)
    while babies < multiplier * 100:
        print 'This generation has {0} babies'.format(babies)
        sys.stdout.flush()
        parents, babies = (babies, parents + babies)
        time.sleep(1)
    

if __name__ == "__main__":
    main()